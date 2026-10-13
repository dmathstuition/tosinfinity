import { describe, expect, it } from 'vitest';
import {
  currentMonth, defaultBillable, flatLine, formatMoney, hourlyLines, invoiceTotal, minorUnits, parseMoney, previousMonth, settledStatus,
  type AttendanceLine,
} from '@/lib/billing';

const lesson = (over: Partial<AttendanceLine>): AttendanceLine => ({ date: '2026-03-02', title: 'Maths', status: 'present', actualMinutes: 60, billable: true, ...over });

describe('hourly invoice calculation', () => {
  it('bills approved lesson time multiplied by the hourly rate', () => {
    const lines = hourlyLines([lesson({}), lesson({ date: '2026-03-09', actualMinutes: 90 })], 500000); // ₦5,000.00 per hour
    expect(lines.map((l) => l.amount_minor)).toEqual([500000, 750000]);
    expect(lines.map((l) => l.quantity)).toEqual([1, 1.5]);
    expect(invoiceTotal(lines)).toBe(1250000);
  });

  it('uses the actual (adjusted) duration, to the nearest minor unit', () => {
    const [line] = hourlyLines([lesson({ actualMinutes: 50 })], 500000);
    expect(line!.amount_minor).toBe(416667); // 50/60 × 500000
    expect(line!.quantity).toBe(0.83);
    expect(hourlyLines([lesson({ actualMinutes: 45 })], 333333)[0]!.amount_minor).toBe(250000);
  });

  it('never bills a lesson that is not marked billable, or has no time', () => {
    const lines = hourlyLines(
      [lesson({ status: 'absent', billable: false, actualMinutes: 0 }), lesson({ status: 'excused', billable: false }), lesson({ billable: true, actualMinutes: 0 }), lesson({})],
      400000,
    );
    expect(lines).toHaveLength(1);
    expect(invoiceTotal(lines)).toBe(400000);
  });

  it('applies explicit adjustments and never produces a negative total', () => {
    const lines = [...hourlyLines([lesson({})], 500000), { description: 'Sibling discount', quantity: 1, unit_minor: -100000, amount_minor: -100000 }];
    expect(invoiceTotal(lines)).toBe(400000);
    expect(invoiceTotal([{ description: 'Credit', quantity: 1, unit_minor: -5, amount_minor: -5 }])).toBe(0);
    expect(invoiceTotal([])).toBe(0);
  });
});

describe('absence policy', () => {
  it('an absence is billable only when the Owner has switched that policy on', () => {
    expect(defaultBillable('absent', false)).toBe(false);
    expect(defaultBillable('absent', true)).toBe(true);
  });
  it('attended lessons are billable and excused lessons never are', () => {
    expect(defaultBillable('present', false)).toBe(true);
    expect(defaultBillable('late', false)).toBe(true);
    expect(defaultBillable('excused', true)).toBe(false);
  });
});

describe('flat fees and periods', () => {
  it('creates one line for monthly or term tuition', () => {
    expect(flatLine('flat_monthly', 4500000, 'March 2026')).toEqual({ description: 'Monthly tuition (March 2026)', quantity: 1, unit_minor: 4500000, amount_minor: 4500000 });
    expect(flatLine('flat_term', 12000000, 'Term 2').description).toBe('Term tuition (Term 2)');
  });
  it('works out the previous and current calendar month, including year and leap-year boundaries', () => {
    expect(previousMonth('2026-01-03')).toMatchObject({ start: '2025-12-01', end: '2025-12-31', label: 'December 2025' });
    expect(previousMonth('2024-03-15')).toMatchObject({ start: '2024-02-01', end: '2024-02-29' });
    expect(previousMonth('2026-03-31')).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
    expect(currentMonth('2026-02-10')).toMatchObject({ start: '2026-02-01', end: '2026-02-28', label: 'February 2026' });
  });
});

describe('invoice status', () => {
  it('follows payments and the due date', () => {
    expect(settledStatus(1000, 0, '2026-03-10', '2026-03-09')).toBe('unpaid');
    expect(settledStatus(1000, 0, '2026-03-10', '2026-03-10')).toBe('unpaid'); // due today is not yet overdue
    expect(settledStatus(1000, 0, '2026-03-10', '2026-03-11')).toBe('overdue');
    expect(settledStatus(1000, 400, '2026-03-10', '2026-03-11')).toBe('partially_paid');
    expect(settledStatus(1000, 1000, '2026-03-10', '2026-03-11')).toBe('paid');
    expect(settledStatus(1000, 1200, null, '2026-03-11')).toBe('paid');
    expect(settledStatus(1000, 0, null, '2026-03-11')).toBe('unpaid');
  });
});

describe('money', () => {
  it('parses amounts into minor units without floating-point drift', () => {
    expect(parseMoney('15000', 'NGN')).toBe(1500000);
    expect(parseMoney('15,000.50', 'NGN')).toBe(1500050);
    expect(parseMoney('0.1', 'USD')).toBe(10);
    expect(parseMoney('19.99', 'USD')).toBe(1999);
    expect(parseMoney('1000', 'JPY')).toBe(1000); // zero-decimal currency
  });
  it('rejects anything that is not a plain positive amount', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e5', '5 000 naira', '=1+1']) expect(parseMoney(bad, 'NGN'), bad).toBeNull();
  });
  it('formats with the configured ISO currency', () => {
    expect(formatMoney(1500050, 'NGN')).toMatch(/15,000\.50/);
    expect(formatMoney(1999, 'usd')).toMatch(/19\.99/);
    expect(minorUnits('NGN')).toBe(100);
    expect(minorUnits('JPY')).toBe(1);
    expect(formatMoney(100, 'ZZZ1')).toContain('1.00'); // unknown code falls back safely
  });
});
