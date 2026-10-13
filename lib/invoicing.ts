import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { flatLine, formatMoney, hourlyLines, type AttendanceLine, type InvoiceLine } from '@/lib/billing';
import { sendEmail } from '@/lib/email';
import { addDays, formatDate, zonedDate, zonedToUtc } from '@/lib/time';

export type BillingSettings = { invoice_day: number; due_days: number; reminder_days_before: number; auto_issue: boolean };
export const DEFAULT_BILLING: BillingSettings = { invoice_day: 1, due_days: 7, reminder_days_before: 3, auto_issue: false };

export async function getBillingSettings(client: SupabaseClient): Promise<BillingSettings> {
  const { data } = await client.from('settings').select('value').eq('key', 'billing').maybeSingle();
  return { ...DEFAULT_BILLING, ...((data?.value as Partial<BillingSettings> | null) ?? {}) };
}

type Period = { start: string; end: string; label: string };
type BilledStudent = { id: string; billing_mode: string | null; hourly_rate_minor: number | null; flat_fee_minor: number | null };

/** Lines for one student and period from their billing settings and approved attendance. */
export async function buildTuitionLines(client: SupabaseClient, student: BilledStudent, period: Period, timezone: string): Promise<InvoiceLine[]> {
  if (student.billing_mode === 'flat_monthly' || student.billing_mode === 'flat_term') {
    return student.flat_fee_minor ? [flatLine(student.billing_mode, Number(student.flat_fee_minor), period.label)] : [];
  }
  if (student.billing_mode !== 'hourly' || !student.hourly_rate_minor) return [];
  const from = zonedToUtc(`${period.start}T00:00`, timezone)!.toISOString();
  const to = zonedToUtc(`${addDays(period.end, 1)}T00:00`, timezone)!.toISOString();
  const { data } = await client
    .from('attendance')
    .select('status, actual_minutes, billable, class:classes!inner(title, starts_at)')
    .eq('student_id', student.id).eq('billable', true)
    .gte('class.starts_at', from).lt('class.starts_at', to);
  const lessons: AttendanceLine[] = (data ?? [])
    .map((a) => {
      const c = Array.isArray(a.class) ? a.class[0] : a.class;
      return c ? { date: zonedDate(c.starts_at, timezone), title: c.title, status: a.status, actualMinutes: a.actual_minutes, billable: a.billable } : null;
    })
    .filter((l): l is AttendanceLine => l !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return hourlyLines(lessons, Number(student.hourly_rate_minor));
}

/**
 * Create one tuition invoice (as a draft) for a student and period.
 * Idempotent: the unique index on (student, period) for tuition invoices means a
 * repeated run finds the existing invoice and creates nothing.
 */
export async function createTuitionInvoice(
  client: SupabaseClient, student: BilledStudent, period: Period, opts: { currency: string; timezone: string; dueDate: string },
): Promise<{ status: 'created' | 'exists' | 'nothing_to_bill' | 'error'; id?: string }> {
  const { data: existing } = await client
    .from('invoices').select('id').eq('student_id', student.id).eq('kind', 'tuition')
    .eq('period_start', period.start).eq('period_end', period.end).neq('status', 'cancelled').maybeSingle();
  if (existing) return { status: 'exists', id: existing.id };

  const lines = await buildTuitionLines(client, student, period, opts.timezone);
  if (lines.length === 0) return { status: 'nothing_to_bill' };

  const { data: number, error: numberError } = await client.rpc('next_invoice_number');
  if (numberError) return { status: 'error' };
  const { data: invoice, error } = await client
    .from('invoices')
    .insert({ number, student_id: student.id, kind: 'tuition', period_start: period.start, period_end: period.end, currency: opts.currency, due_date: opts.dueDate, status: 'draft' })
    .select('id')
    .single();
  if (error) return { status: error.code === '23505' ? 'exists' : 'error' }; // lost a race with another run
  const { error: itemsError } = await client.from('invoice_items').insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })));
  if (itemsError) {
    await client.from('invoices').delete().eq('id', invoice.id);
    return { status: 'error' };
  }
  return { status: 'created', id: invoice.id };
}

type FamilyContact = { full_name: string; email: string };

/** Student + verified parents, read with whichever client the caller is entitled to use. */
export async function invoiceContacts(client: SupabaseClient, studentId: string): Promise<FamilyContact[]> {
  const [{ data: student }, { data: links }] = await Promise.all([
    client.from('profiles').select('full_name, email, status').eq('id', studentId).maybeSingle(),
    client.from('parent_student_links').select('parent:profiles!parent_student_links_parent_id_fkey(full_name, email, status)').eq('student_id', studentId).not('verified_at', 'is', null),
  ]);
  const parents = (links ?? []).map((l) => (Array.isArray(l.parent) ? l.parent[0] : l.parent)).filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.status === 'active');
  // Invoices go to parents when there are any; otherwise to the (adult) student.
  const list = parents.length ? parents : student && student.status === 'active' ? [student] : [];
  return list.map((p) => ({ full_name: p.full_name, email: p.email }));
}

/** Draft → issued. Sets the due date, freezes the invoice and tells the family. */
export async function issueInvoice(
  client: SupabaseClient, invoiceId: string, opts: { asService?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  const { data: inv } = await client.from('invoices').select('id, number, status, total_minor, currency, due_date, student_id').eq('id', invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: 'Invoice not found.' };
  if (inv.status !== 'draft') return { ok: false, error: 'This invoice has already been issued.' };
  if (!inv.due_date) return { ok: false, error: 'Set a due date before issuing.' };
  if (Number(inv.total_minor) <= 0) return { ok: false, error: 'Add at least one line item with an amount before issuing.' };
  const { error } = await client.from('invoices').update({ status: 'unpaid', issued_at: new Date().toISOString() }).eq('id', invoiceId).eq('status', 'draft');
  if (error) return { ok: false, error: 'Could not issue the invoice.' };

  // notify_family is service-role only (cron); the Owner's session uses the checked wrapper.
  await client.rpc(opts.asService ? 'notify_family' : 'owner_notify_family', {
    p_student: inv.student_id, p_title: 'New invoice', p_body: `Invoice ${inv.number}`, p_path: '/invoices',
  });
  const amount = formatMoney(Number(inv.total_minor), inv.currency);
  for (const c of await invoiceContacts(client, inv.student_id)) {
    await sendEmail('invoiceIssued', c.email, { name: c.full_name, number: inv.number, amount, due: formatDate(inv.due_date) });
  }
  return { ok: true };
}
