import { Logo } from '@/components/brand/Logo';
import { Badge, type BadgeTone } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/billing';
import { formatDate } from '@/lib/time';

export type InvoiceView = {
  number: string; status: string; currency: string; total_minor: number; paid_minor: number;
  period_start: string; period_end: string; due_date: string | null; issued_at: string | null; notes: string | null;
  student_name: string; student_code: string | null;
  items: Array<{ description: string; quantity: number; unit_minor: number; amount_minor: number }>;
  payments: Array<{ amount_minor: number; method: string; reference: string; paid_at: string }>;
};

const TONE: Record<string, BadgeTone> = { paid: 'green', overdue: 'red', partially_paid: 'gold', unpaid: 'orange', cancelled: 'neutral', draft: 'neutral' };
const METHOD: Record<string, string> = { paystack: 'Online (Paystack)', bank_transfer: 'Bank transfer', cash: 'Cash', adjustment: 'Adjustment' };

/** Printable invoice with its receipts. Shared by the Owner, student and parent views. */
export function InvoiceDocument({ invoice: v, academy }: { invoice: InvoiceView; academy: { name: string; phones: string[]; email: string } }) {
  const balance = Math.max(0, v.total_minor - v.paid_minor);
  const money = (n: number) => formatMoney(n, v.currency);
  return (
    <article data-theme="light" className="mx-auto max-w-3xl rounded-card border border-line bg-white p-6 text-ink shadow-card print:border-0 print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-gold pb-5">
        <div>
          <Logo size={48} />
          <p className="mt-3 text-sm text-muted">{academy.phones.join(' · ')}{academy.email ? ` · ${academy.email}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-semibold text-navy">{v.status === 'draft' ? 'Invoice preview' : 'Invoice'}</p>
          <p className="tabular-nums">{v.number}</p>
          <p className="mt-1"><Badge tone={TONE[v.status]}>{v.status.replace('_', ' ')}</Badge></p>
        </div>
      </header>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-muted">Billed for</dt><dd className="font-semibold">{v.student_name}</dd><dd className="text-sm text-muted">{v.student_code}</dd></div>
        <div><dt className="text-sm text-muted">Billing period</dt><dd className="font-semibold">{formatDate(v.period_start)} to {formatDate(v.period_end)}</dd></div>
        <div><dt className="text-sm text-muted">Due date</dt><dd className="font-semibold">{v.due_date ? formatDate(v.due_date) : '—'}</dd>{v.issued_at && <dd className="text-sm text-muted">Issued {formatDate(v.issued_at)}</dd>}</div>
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Invoice line items</caption>
          <thead><tr className="border-b border-line text-left text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">Description</th><th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Rate</th><th scope="col" className="py-2 text-right font-medium">Amount</th>
          </tr></thead>
          <tbody>
            {v.items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2 pr-3">{it.description}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{Number(it.quantity)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(Number(it.unit_minor))}</td>
                <td className="py-2 text-right tabular-nums">{money(Number(it.amount_minor))}</td>
              </tr>
            ))}
            {v.items.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted">No line items.</td></tr>}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={3} className="py-2 pr-3 text-right font-semibold">Total</th><td className="py-2 text-right font-semibold tabular-nums">{money(v.total_minor)}</td></tr>
            <tr><th scope="row" colSpan={3} className="py-1 pr-3 text-right font-normal text-muted">Paid</th><td className="py-1 text-right tabular-nums">{money(v.paid_minor)}</td></tr>
            <tr><th scope="row" colSpan={3} className="py-2 pr-3 text-right font-semibold">Balance due</th><td className="py-2 text-right font-heading text-lg font-bold tabular-nums text-navy">{money(v.status === 'cancelled' ? 0 : balance)}</td></tr>
          </tfoot>
        </table>
      </div>
      {v.notes && <p className="mt-4 whitespace-pre-line text-sm text-muted">{v.notes}</p>}

      {v.payments.length > 0 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-semibold">Payment receipts</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Date</th><th scope="col" className="py-2 pr-3 font-medium">Method</th>
                <th scope="col" className="py-2 pr-3 font-medium">Reference</th><th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr></thead>
              <tbody>
                {v.payments.map((p) => (
                  <tr key={p.reference} className="border-b border-line">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(p.paid_at)}</td>
                    <td className="py-2 pr-3">{METHOD[p.method] ?? p.method}</td>
                    <td className="py-2 pr-3 break-all">{p.reference}</td>
                    <td className="py-2 text-right tabular-nums">{money(Number(p.amount_minor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <footer className="mt-10 border-t border-line pt-4 text-sm text-muted">{academy.name} · Thank you.</footer>
    </article>
  );
}
