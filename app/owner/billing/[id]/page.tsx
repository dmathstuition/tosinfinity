import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InvoiceDocument, type InvoiceView } from '@/components/portal/InvoiceDocument';
import { PrintButton } from '@/components/portal/PrintButton';
import { ActionForm } from '@/components/ui/ActionForm';
import { Alert, Card } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/billing';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { getSiteSettings } from '@/lib/site';
import { zonedDate } from '@/lib/time';
import {
  addItemAction, cancelInvoiceAction, deleteDraftAction, issueInvoiceAction, recordPaymentAction, removeItemAction, sendReminderAction, updateDraftAction,
} from '../actions';

export const metadata = { title: 'Invoice' };

export default async function InvoicePage({ params, searchParams }: { params: { id: string }; searchParams: { payment?: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, student:profiles(id, full_name, student_code), invoice_items(id, description, quantity, unit_minor, amount_minor), payments(amount_minor, method, reference, paid_at, note)')
    .eq('id', params.id)
    .maybeSingle();
  if (!inv) notFound();
  const { academy } = await getSiteSettings();
  const student = Array.isArray(inv.student) ? inv.student[0] : inv.student;
  const items = (inv.invoice_items ?? []) as Array<{ id: string; description: string; quantity: number; unit_minor: number; amount_minor: number }>;
  const view: InvoiceView = {
    ...inv, total_minor: Number(inv.total_minor), paid_minor: Number(inv.paid_minor),
    student_name: student?.full_name ?? '', student_code: student?.student_code ?? null, items,
    payments: [...(inv.payments ?? [])].sort((a: { paid_at: string }, b: { paid_at: string }) => a.paid_at.localeCompare(b.paid_at)),
  };
  const draft = inv.status === 'draft';
  const open = ['unpaid', 'partially_paid', 'overdue'].includes(inv.status);
  const balance = view.total_minor - view.paid_minor;
  const today = zonedDate(new Date(), timezone);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/owner/billing" className="text-sm text-link hover:underline">← Billing</Link>
        <div className="flex gap-2">
          {student && <Link href={`/owner/students/${student.id}`} className="inline-flex min-h-[36px] items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:border-royal">Student profile</Link>}
          <PrintButton label={draft ? 'Print preview' : 'Print or save invoice'} />
        </div>
      </div>
      {searchParams.payment === 'paid' && <div className="no-print mb-4"><Alert tone="success">The online payment has been confirmed and credited.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="no-print space-y-6">
          {draft && (
            <>
              <Alert tone="info">This is a draft. The family cannot see it until you issue it.</Alert>
              <Card>
                <h2 className="mb-3 text-lg font-semibold">Line items</h2>
                <ul className="mb-4 divide-y divide-line">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">{it.description}<br /><span className="text-muted tabular-nums">{Number(it.quantity)} × {formatMoney(Number(it.unit_minor), inv.currency)}</span></span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="tabular-nums">{formatMoney(Number(it.amount_minor), inv.currency)}</span>
                        <ActionForm action={removeItemAction} submitLabel="Remove" variant="outline" size="sm" hidden={{ id: inv.id, item_id: it.id }} />
                      </span>
                    </li>
                  ))}
                  {items.length === 0 && <li className="py-2 text-sm text-muted">No line items yet.</li>}
                </ul>
                <ActionForm action={addItemAction} submitLabel="Add line" variant="secondary" size="sm" hidden={{ id: inv.id }} resetOnSuccess>
                  <div><label htmlFor="description" className="label">Description</label><input id="description" name="description" required maxLength={200} className="field" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="quantity" className="label">Quantity</label><input id="quantity" name="quantity" inputMode="decimal" defaultValue="1" required className="field" /></div>
                    <div><label htmlFor="unit_price" className="label">Unit price ({inv.currency})</label><input id="unit_price" name="unit_price" inputMode="decimal" required className="field" placeholder="-500 for a discount" /></div>
                  </div>
                </ActionForm>
              </Card>
              <Card>
                <h2 className="mb-3 text-lg font-semibold">Due date and note</h2>
                <ActionForm action={updateDraftAction} submitLabel="Save" variant="secondary" size="sm" hidden={{ id: inv.id }}>
                  <div><label htmlFor="due_date" className="label">Due date</label><input id="due_date" name="due_date" type="date" required defaultValue={inv.due_date ?? ''} className="field" /></div>
                  <div><label htmlFor="notes" className="label">Note on the invoice</label><textarea id="notes" name="notes" rows={2} defaultValue={inv.notes ?? ''} className="field" /></div>
                </ActionForm>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold">Issue</h2>
                <p className="mb-3 mt-1 text-sm text-muted">Check the preview. Issuing locks the amounts, makes the invoice visible to the family and notifies them.</p>
                <div className="flex flex-wrap gap-3">
                  <ActionForm action={issueInvoiceAction} submitLabel="Issue invoice" hidden={{ id: inv.id }} confirm={`Issue ${inv.number} for ${formatMoney(view.total_minor, inv.currency)}?`} />
                  <ActionForm action={deleteDraftAction} submitLabel="Delete draft" variant="outline" hidden={{ id: inv.id }} confirm="Delete this draft?" />
                </div>
              </Card>
            </>
          )}

          {open && (
            <>
              <Card>
                <h2 className="text-lg font-semibold">Record a payment</h2>
                <p className="mb-4 mt-1 text-sm text-muted">
                  For bank transfers and cash you have confirmed yourself. Balance due: <strong>{formatMoney(balance, inv.currency)}</strong>. Entries are permanent; correct a mistake with an adjustment.
                </p>
                <ActionForm action={recordPaymentAction} submitLabel="Record payment" hidden={{ id: inv.id }} resetOnSuccess confirm="Record this payment? It cannot be edited afterwards.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="method" className="label">Method</label>
                      <select id="method" name="method" required className="field">
                        <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="adjustment">Adjustment (correction or credit)</option>
                      </select>
                    </div>
                    <div><label htmlFor="amount" className="label">Amount ({inv.currency})</label><input id="amount" name="amount" inputMode="decimal" required className="field" /></div>
                    <div><label htmlFor="reference" className="label">Reference</label><input id="reference" name="reference" required maxLength={120} placeholder="Transfer reference or receipt no." className="field" /></div>
                    <div><label htmlFor="paid_on" className="label">Date received</label><input id="paid_on" name="paid_on" type="date" required defaultValue={today} max={today} className="field" /></div>
                  </div>
                  <div><label htmlFor="note" className="label">Note (optional)</label><input id="note" name="note" maxLength={300} className="field" /></div>
                </ActionForm>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold">Reminder</h2>
                <p className="mb-3 mt-1 text-sm text-muted">Sends a payment reminder now. Automatic reminders also go out before and after the due date.</p>
                <ActionForm action={sendReminderAction} submitLabel="Send reminder" variant="outline" size="sm" hidden={{ id: inv.id }} />
              </Card>
              {view.paid_minor === 0 && (
                <Card>
                  <h2 className="text-lg font-semibold">Cancel invoice</h2>
                  <ActionForm action={cancelInvoiceAction} submitLabel="Cancel invoice" variant="danger" size="sm" hidden={{ id: inv.id }} confirm="Cancel this invoice? This cannot be undone.">
                    <div><label htmlFor="reason" className="label">Reason (kept in the audit log)</label><input id="reason" name="reason" required maxLength={300} className="field" /></div>
                  </ActionForm>
                </Card>
              )}
            </>
          )}
          {inv.status === 'paid' && <Alert tone="success">Paid in full. Receipts are listed on the invoice.</Alert>}
          {inv.status === 'cancelled' && <Alert tone="warning">This invoice was cancelled and is kept for the record.</Alert>}
        </div>

        <InvoiceDocument invoice={view} academy={academy} />
      </div>
    </>
  );
}
