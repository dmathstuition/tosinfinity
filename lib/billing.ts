/**
 * Billing maths. Pure functions (no I/O) so they can be unit-tested.
 * All money is held in minor units (kobo, cents) as integers.
 */

export type BillingMode = 'hourly' | 'flat_monthly' | 'flat_term';

export type AttendanceLine = {
  date: string; // YYYY-MM-DD
  title: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  actualMinutes: number;
  billable: boolean;
};

export type InvoiceLine = { description: string; quantity: number; unit_minor: number; amount_minor: number };

/**
 * Default billable flag when attendance is recorded. An absence is never billable
 * unless the Owner has switched on "bill absences" for that student.
 */
export function defaultBillable(status: AttendanceLine['status'], billAbsences: boolean): boolean {
  if (status === 'present' || status === 'late') return true;
  if (status === 'absent') return billAbsences;
  return false; // excused
}

/** Hourly mode: one line per billable lesson, hours rounded to 2 dp, amount to the minor unit. */
export function hourlyLines(lessons: AttendanceLine[], hourlyRateMinor: number): InvoiceLine[] {
  return lessons
    .filter((l) => l.billable && l.actualMinutes > 0)
    .map((l) => {
      const hours = Math.round((l.actualMinutes / 60) * 100) / 100;
      return {
        description: `${l.title} (${l.date})`,
        quantity: hours,
        unit_minor: hourlyRateMinor,
        amount_minor: Math.round((l.actualMinutes * hourlyRateMinor) / 60),
      };
    });
}

export function flatLine(mode: 'flat_monthly' | 'flat_term', feeMinor: number, periodLabel: string): InvoiceLine {
  return {
    description: `${mode === 'flat_monthly' ? 'Monthly tuition' : 'Term tuition'} (${periodLabel})`,
    quantity: 1,
    unit_minor: feeMinor,
    amount_minor: feeMinor,
  };
}

/** Total can never go below zero even with negative adjustment lines. */
export function invoiceTotal(lines: InvoiceLine[]): number {
  return Math.max(0, lines.reduce((sum, l) => sum + l.amount_minor, 0));
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

/** Mirrors the database trigger; used for display and tests. */
export function settledStatus(totalMinor: number, paidMinor: number, dueDate: string | null, today: string): InvoiceStatus {
  if (paidMinor >= totalMinor) return 'paid';
  if (paidMinor > 0) return 'partially_paid';
  if (dueDate && dueDate < today) return 'overdue';
  return 'unpaid';
}

/** Previous calendar month relative to `today` (YYYY-MM-DD) → inclusive period. */
export function previousMonth(today: string): { start: string; end: string; label: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 2, 1));
  const end = new Date(Date.UTC(y, m - 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
  };
}

export function currentMonth(today: string): { start: string; end: string; label: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
  };
}

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'XOF', 'XAF', 'UGX', 'RWF']);

export function minorUnits(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: code }).format(minor / minorUnits(code));
  } catch {
    return `${code} ${(minor / minorUnits(code)).toFixed(2)}`;
  }
}

/** "12,500.50" or "12500" → minor units. Returns null for invalid or negative input. */
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * minorUnits(currency));
}
