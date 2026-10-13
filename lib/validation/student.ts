import { z } from 'zod';

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || '');

/** Shared by "Add student", the profile editor and CSV import. */
export const studentSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(254),
  phone: opt(30),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || '')
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date of birth must be YYYY-MM-DD'),
  school_year: opt(60),
  curriculum: opt(60),
  location: opt(200),
  learning_needs: opt(1000),
  goals: opt(1000),
  delivery: z.enum(['home', 'online', '']).optional().transform((v) => v ?? ''),
});
export type StudentInput = z.output<typeof studentSchema>;

export const STUDENT_CSV_COLUMNS = ['full_name', 'email', 'phone', 'date_of_birth', 'school_year', 'curriculum', 'location', 'delivery'] as const;

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Quote a value for CSV and neutralise spreadsheet formulas (=, +, -, @). */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type CsvRowResult = { line: number; data: Record<string, string>; errors: string[] };

/** Validate parsed CSV rows, flagging duplicates within the file and against existing emails. */
export function validateStudentRows(rows: string[][], existingEmails: string[] = []): { header: string[]; results: CsvRowResult[]; headerError?: string } {
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!header.includes('full_name') || !header.includes('email')) {
    return { header, results: [], headerError: 'The first row must contain at least the columns full_name and email.' };
  }
  const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
  const seen = new Set<string>();
  const results = rows.slice(1).map((cells, i) => {
    const data: Record<string, string> = {};
    header.forEach((h, c) => {
      if ((STUDENT_CSV_COLUMNS as readonly string[]).includes(h)) data[h] = (cells[c] ?? '').trim();
    });
    if (data.delivery) data.delivery = data.delivery.toLowerCase();
    const parsed = studentSchema.safeParse(data);
    const errors = parsed.success ? [] : parsed.error.issues.map((x) => x.message);
    const email = (data.email ?? '').toLowerCase();
    if (email) {
      if (seen.has(email)) errors.push('Duplicate email within this file');
      if (existing.has(email)) errors.push('A student or account with this email already exists');
      seen.add(email);
    }
    return { line: i + 2, data, errors };
  });
  return { header, results };
}
