import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/primitives';
import { currentMonth } from '@/lib/billing';
import { getBillingSettings } from '@/lib/invoicing';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { addDays, zonedDate } from '@/lib/time';
import { createInvoiceAction } from '../actions';

export const metadata = { title: 'Create invoice' };

export default async function NewInvoicePage({ searchParams }: { searchParams: { student?: string } }) {
  const { supabase } = await ownerContext();
  const { currency, timezone } = await academyLocale();
  const today = zonedDate(new Date(), timezone);
  const month = currentMonth(today);
  const [{ data: students }, settings] = await Promise.all([
    supabase.from('profiles').select('id, full_name, billing_mode').eq('role', 'student').eq('status', 'active').order('full_name'),
    getBillingSettings(supabase),
  ]);
  const preset = searchParams.student && isUuid(searchParams.student) ? searchParams.student : '';

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/billing" className="text-link hover:underline">← Billing</Link></p>
      <PageHeader title="Create invoice" description="Saved as a draft so you can preview it before issuing." />
      <Card className="max-w-3xl">
        <ActionForm action={createInvoiceAction} submitLabel="Create draft">
          <div>
            <label htmlFor="student_id" className="label">Student</label>
            <select id="student_id" name="student_id" required defaultValue={preset} className="field">
              <option value="" disabled>Select…</option>
              {(students ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.billing_mode ? ` (${s.billing_mode.replace('_', ' ')})` : ''}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="period_start" className="label">Period from</label><input id="period_start" name="period_start" type="date" required defaultValue={month.start} className="field" /></div>
            <div><label htmlFor="period_end" className="label">Period to</label><input id="period_end" name="period_end" type="date" required defaultValue={month.end} className="field" /></div>
            <div><label htmlFor="due_date" className="label">Due date</label><input id="due_date" name="due_date" type="date" required defaultValue={addDays(today, settings.due_days)} className="field" /></div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="from_settings" className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
            <span>Add tuition from this student’s billing settings (hourly: billable lesson time in the period × their rate; flat: their agreed fee).</span>
          </label>
          <div>
            <label htmlFor="items" className="label">Line items and adjustments ({currency})</label>
            <textarea id="items" name="items" rows={4} className="field font-mono text-sm" placeholder={'Revision workbook | 1 | 3500\nSibling discount | 1 | -2000'} aria-describedby="items-hint" />
            <p id="items-hint" className="mt-1 text-xs text-muted">One per line: Description | quantity | unit price. Use a minus sign for a discount or credit.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="instalments" className="label">Instalments</label>
              <select id="instalments" name="instalments" defaultValue="1" className="field" aria-describedby="inst-hint">
                <option value="1">Single invoice</option>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} instalments, due monthly</option>)}
              </select>
              <p id="inst-hint" className="mt-1 text-xs text-muted">Splits the total into separate invoices, the first due on the date above.</p>
            </div>
            <div><label htmlFor="notes" className="label">Note on the invoice</label><input id="notes" name="notes" maxLength={1000} className="field" /></div>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
