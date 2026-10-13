import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InvoiceDocument, type InvoiceView } from '@/components/portal/InvoiceDocument';
import { PrintButton } from '@/components/portal/PrintButton';
import { Alert } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/billing';
import { one } from '@/lib/family';
import { getProvider } from '@/lib/payments';
import { getSiteSettings } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

const NOTICE: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  paid: { tone: 'success', text: 'Thank you. Your payment has been confirmed and a receipt has been added below.' },
  pending: { tone: 'warning', text: 'We have not received confirmation of the payment yet. If you completed it, this page will update shortly; please do not pay again.' },
  failed: { tone: 'error', text: 'The payment was not completed. You have not been charged by us. You can try again.' },
  unavailable: { tone: 'warning', text: 'Online payment is not available at the moment. Please contact the academy to arrange payment.' },
};

/**
 * Invoice view for a student or parent. RLS returns the invoice only to the student
 * it belongs to or a verified parent; draft invoices are never returned to families.
 */
export async function FamilyInvoicePage({ id, backHref, payment }: { id: string; backHref: string; payment?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = createClient();
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, student:profiles(full_name, student_code), invoice_items(description, quantity, unit_minor, amount_minor), payments(amount_minor, method, reference, paid_at)')
    .eq('id', id)
    .maybeSingle();
  if (!inv) notFound();
  const { academy } = await getSiteSettings();
  const student = one(inv.student);
  const view: InvoiceView = {
    ...inv, total_minor: Number(inv.total_minor), paid_minor: Number(inv.paid_minor),
    student_name: student?.full_name ?? '', student_code: student?.student_code ?? null,
    items: inv.invoice_items ?? [], payments: (inv.payments ?? []).sort((a: { paid_at: string }, b: { paid_at: string }) => a.paid_at.localeCompare(b.paid_at)),
  };
  const balance = view.total_minor - view.paid_minor;
  const payable = balance > 0 && ['unpaid', 'partially_paid', 'overdue'].includes(inv.status);
  const notice = payment ? NOTICE[payment] : undefined;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-link hover:underline">← Invoices</Link>
        <PrintButton label="Print or save invoice" />
      </div>
      {notice && <div className="no-print mx-auto mb-4 max-w-3xl"><Alert tone={notice.tone}>{notice.text}</Alert></div>}
      {payable && (
        <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
          <p><span className="text-muted">Balance due:</span> <span className="font-heading text-xl font-bold">{formatMoney(balance, inv.currency)}</span></p>
          {getProvider().configured() ? (
            <form action="/api/payments/initialise" method="post">
              <input type="hidden" name="invoice_id" value={inv.id} />
              <button type="submit" className="min-h-[48px] rounded-xl bg-orange px-6 font-semibold text-navy hover:bg-gold">Pay securely online</button>
            </form>
          ) : <p className="text-sm text-muted">Online payment is not set up yet. Please contact the academy to pay by transfer or cash.</p>}
        </div>
      )}
      <InvoiceDocument invoice={view} academy={academy} />
    </>
  );
}
