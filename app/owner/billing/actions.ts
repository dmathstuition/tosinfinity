'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatMoney, parseMoney } from '@/lib/billing';
import { sendEmail } from '@/lib/email';
import { buildTuitionLines, createTuitionInvoice, getBillingSettings, invoiceContacts, issueInvoice } from '@/lib/invoicing';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { addDays, formatDate, zonedDate } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function periodLabel(start: string, end: string) {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

/** Draft tuition invoices for every student with automatic billing. Safe to run twice. */
export async function generateInvoicesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { currency, timezone } = await academyLocale();
  const start = str(fd, 'period_start');
  const end = str(fd, 'period_end');
  if (!DATE.test(start) || !DATE.test(end) || end < start) return fail('Choose a valid billing period.');
  const settings = await getBillingSettings(supabase);
  const dueDate = addDays(zonedDate(new Date(), timezone), settings.due_days);

  const { data: students } = await supabase
    .from('profiles').select('id, billing_mode, hourly_rate_minor, flat_fee_minor')
    .eq('role', 'student').eq('status', 'active').in('billing_mode', ['hourly', 'flat_monthly']);
  const tally = { created: 0, exists: 0, nothing_to_bill: 0, error: 0 };
  for (const s of students ?? []) {
    const r = await createTuitionInvoice(supabase, s, { start, end, label: periodLabel(start, end) }, { currency, timezone, dueDate });
    tally[r.status] += 1;
  }
  await audit('invoices.generated', 'invoice', null, { period_start: start, period_end: end, ...tally });
  revalidatePath('/owner/billing');
  return ok(
    `${tally.created} draft invoice${tally.created === 1 ? '' : 's'} created. ${tally.exists} already existed, ${tally.nothing_to_bill} had nothing to bill` +
      (tally.error ? `, ${tally.error} failed` : '') + '. Review each draft, then issue it.',
  );
}

/** One line per row: "Description | quantity | unit price". */
function parseItems(text: string, currency: string): { items: Array<{ description: string; quantity: number; unit_minor: number; amount_minor: number }>; error?: string } {
  const items = [];
  for (const raw of text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 40)) {
    const [description, qty = '1', price = ''] = raw.split('|').map((p) => p.trim());
    const negative = price.startsWith('-');
    const unit = parseMoney(price.replace(/^-/, ''), currency);
    const quantity = Number(qty);
    if (!description || unit === null || !Number.isFinite(quantity) || quantity <= 0) {
      return { items: [], error: `Could not read this line: “${raw}”. Use: Description | quantity | unit price.` };
    }
    const unitMinor = negative ? -unit : unit;
    items.push({ description: description.slice(0, 200), quantity, unit_minor: unitMinor, amount_minor: Math.round(quantity * unitMinor) });
  }
  return { items };
}

export async function createInvoiceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { currency, timezone } = await academyLocale();
  const student = str(fd, 'student_id');
  const start = str(fd, 'period_start');
  const end = str(fd, 'period_end');
  const due = str(fd, 'due_date');
  if (!isUuid(student)) return fail('Choose a student.');
  if (!DATE.test(start) || !DATE.test(end) || end < start) return fail('Choose a valid billing period.');
  if (!DATE.test(due)) return fail('Choose a due date.');

  let { items, error } = parseItems(str(fd, 'items', 6000), currency);
  if (error) return fail(error);
  if (fd.get('from_settings') === 'on') {
    const { data: s } = await supabase.from('profiles').select('id, billing_mode, hourly_rate_minor, flat_fee_minor').eq('id', student).maybeSingle();
    if (!s?.billing_mode) return fail('This student has no billing mode set. Set it on their profile, or enter line items.');
    items = [...(await buildTuitionLines(supabase, s, { start, end, label: periodLabel(start, end) }, timezone)), ...items];
  }
  if (items.length === 0) return fail('There is nothing to bill. Enter at least one line item.');
  const total = items.reduce((sum, i) => sum + i.amount_minor, 0);
  if (total <= 0) return fail('The invoice total must be greater than zero.');

  // Optional instalments: the same total split across several invoices, due a month apart.
  const parts = Math.min(6, Math.max(1, Number(str(fd, 'instalments')) || 1));
  let firstId = '';
  for (let i = 0; i < parts; i++) {
    const { data: number } = await supabase.rpc('next_invoice_number');
    const dueDate = new Date(`${due}T00:00:00Z`);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
    const { data: inv, error: insertError } = await supabase
      .from('invoices')
      .insert({
        number, student_id: student, kind: 'adhoc', period_start: start, period_end: end, currency, status: 'draft',
        due_date: dueDate.toISOString().slice(0, 10), notes: [parts > 1 ? `Instalment ${i + 1} of ${parts}` : '', str(fd, 'notes', 1000)].filter(Boolean).join('\n') || null,
      })
      .select('id')
      .single();
    if (insertError) return fail('Could not create the invoice.');
    const rows = parts === 1
      ? items
      : [{ description: `Tuition ${periodLabel(start, end)} (instalment ${i + 1} of ${parts})`, quantity: 1, unit_minor: 0, amount_minor: 0 }];
    if (parts > 1) {
      // Even split; the last instalment absorbs any rounding remainder.
      const share = i === parts - 1 ? total - Math.floor(total / parts) * (parts - 1) : Math.floor(total / parts);
      rows[0]!.unit_minor = share;
      rows[0]!.amount_minor = share;
    }
    await supabase.from('invoice_items').insert(rows.map((r) => ({ ...r, invoice_id: inv.id })));
    await audit('invoice.created', 'invoice', inv.id, { number });
    firstId ||= inv.id;
  }
  revalidatePath('/owner/billing');
  redirect(parts > 1 ? '/owner/billing?status=draft' : `/owner/billing/${firstId}`);
}

export async function addItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { currency } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown invoice.');
  const { items, error } = parseItems(`${str(fd, 'description', 200)} | ${str(fd, 'quantity') || '1'} | ${str(fd, 'unit_price')}`, currency);
  if (error || !items[0]) return fail('Enter a description, a quantity and a unit price. Use a minus sign for a discount.');
  const { error: insertError } = await supabase.from('invoice_items').insert({ ...items[0], invoice_id: id });
  if (insertError) return fail('Line items can only be changed while the invoice is a draft.');
  revalidatePath(`/owner/billing/${id}`);
  return ok('Line added.');
}

export async function removeItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const item = str(fd, 'item_id');
  if (!isUuid(item)) return fail('Unknown line.');
  const { error } = await supabase.from('invoice_items').delete().eq('id', item);
  if (error) return fail('Line items can only be changed while the invoice is a draft.');
  revalidatePath(`/owner/billing/${str(fd, 'id')}`);
  return ok('Line removed.');
}

export async function updateDraftAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  const due = str(fd, 'due_date');
  if (!isUuid(id) || !DATE.test(due)) return fail('Choose a due date.');
  const { error } = await supabase.from('invoices').update({ due_date: due, notes: str(fd, 'notes', 1000) || null }).eq('id', id).eq('status', 'draft');
  if (error) return fail('Could not save.');
  revalidatePath(`/owner/billing/${id}`);
  return ok('Saved.');
}

export async function issueInvoiceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown invoice.');
  const result = await issueInvoice(supabase, id);
  if (!result.ok) return fail(result.error ?? 'Could not issue the invoice.');
  await audit('invoice.issued', 'invoice', id);
  revalidatePath(`/owner/billing/${id}`);
  revalidatePath('/owner/billing');
  return ok('Invoice issued. The family has been notified.');
}

export async function cancelInvoiceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  const reason = str(fd, 'reason', 300);
  if (!isUuid(id)) return fail('Unknown invoice.');
  if (reason.length < 3) return fail('Give a short reason for cancelling. It is kept in the audit log.');
  const { data, error } = await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id).in('status', ['unpaid', 'overdue']).select('id').maybeSingle();
  if (error || !data) return fail('Only an unpaid invoice with no payments can be cancelled. For a part-paid invoice, record an adjustment instead.');
  await audit('invoice.cancelled', 'invoice', id, { reason });
  revalidatePath(`/owner/billing/${id}`);
  return ok('Invoice cancelled.');
}

export async function deleteDraftAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown invoice.');
  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('status', 'draft');
  if (error) return fail('Only a draft can be deleted.');
  await audit('invoice.draft_deleted', 'invoice', id);
  redirect('/owner/billing');
}

/** Manual bank-transfer or cash payment, or a signed adjustment. Written to the append-only ledger. */
export async function recordPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown invoice.');
  const method = ['bank_transfer', 'cash', 'adjustment'].find((m) => m === str(fd, 'method'));
  if (!method) return fail('Choose how the payment was made.');
  const { data: inv } = await supabase.from('invoices').select('number, currency, total_minor, paid_minor, status, student_id').eq('id', id).maybeSingle();
  if (!inv) return fail('Unknown invoice.');
  if (['draft', 'cancelled'].includes(inv.status)) return fail('Payments can only be recorded against an issued invoice.');

  const raw = str(fd, 'amount');
  const negative = raw.startsWith('-');
  const parsed = parseMoney(raw.replace(/^-/, ''), inv.currency);
  if (!parsed) return fail('Enter the amount as a number, for example 15000 or 15000.50.');
  if (negative && method !== 'adjustment') return fail('Only an adjustment can be negative.');
  const amount = negative ? -parsed : parsed;
  const balance = Number(inv.total_minor) - Number(inv.paid_minor);
  if (amount > balance) return fail(`That is more than the balance due (${formatMoney(balance, inv.currency)}).`);
  if (Number(inv.paid_minor) + amount < 0) return fail('An adjustment cannot take the amount paid below zero.');

  const reference = str(fd, 'reference', 120);
  if (reference.length < 3) return fail('Enter a reference, such as the bank transfer reference or a receipt number.');
  const paidOn = str(fd, 'paid_on');
  if (!DATE.test(paidOn) || paidOn > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return fail('Enter the date the payment was received.');

  // credit_payment() re-checks the Owner in the database, records who entered it and
  // writes the audit entry. A repeated reference is refused rather than double-counted.
  const { data: credited, error } = await supabase.rpc('credit_payment', {
    p_invoice: id, p_amount_minor: amount, p_currency: inv.currency, p_method: method,
    p_reference: `MAN-${inv.number}-${reference}`, p_paid_at: `${paidOn}T12:00:00Z`, p_note: str(fd, 'note', 300) || null, p_payload: null,
  });
  if (error) return fail('The payment could not be recorded.');
  if (!credited) return fail('A payment with this reference has already been recorded for this invoice.');

  if (amount > 0) {
    for (const c of await invoiceContacts(supabase, inv.student_id)) {
      await sendEmail('paymentReceipt', c.email, { name: c.full_name, number: inv.number, amount: formatMoney(amount, inv.currency), reference });
    }
  }
  revalidatePath(`/owner/billing/${id}`);
  revalidatePath('/owner/billing');
  return ok('Payment recorded and receipt added.');
}

export async function sendReminderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown invoice.');
  const { data: inv } = await supabase.from('invoices').select('number, currency, total_minor, paid_minor, status, due_date, student_id').eq('id', id).maybeSingle();
  if (!inv || !['unpaid', 'partially_paid', 'overdue'].includes(inv.status)) return fail('Reminders can only be sent for an invoice with a balance due.');
  const contacts = await invoiceContacts(supabase, inv.student_id);
  const overdue = Boolean(inv.due_date && inv.due_date < zonedDate(new Date(), timezone));
  let sent = 0;
  for (const c of contacts) {
    const r = await sendEmail('paymentReminder', c.email, {
      name: c.full_name, number: inv.number, amount: formatMoney(Number(inv.total_minor) - Number(inv.paid_minor), inv.currency),
      due: inv.due_date ? formatDate(inv.due_date) : 'the agreed date', overdue,
    });
    if (r.ok) sent += 1;
  }
  await supabase.rpc('owner_notify_family', { p_student: inv.student_id, p_title: overdue ? 'Invoice overdue' : 'Payment reminder', p_body: `Invoice ${inv.number}`, p_path: '/invoices' });
  await audit('invoice.reminder_sent', 'invoice', id, { emailed: sent });
  return ok(sent ? `Reminder sent to ${sent} contact${sent === 1 ? '' : 's'}.` : 'An in-app reminder was posted. No email was sent because email is not configured.');
}
