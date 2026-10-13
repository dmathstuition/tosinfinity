import { describe, expect, it } from 'vitest';
import { addDays, overlaps, utcToZonedInput, weekStart, zonedDate, zonedToUtc } from '@/lib/time';
import { applicationSchema } from '@/lib/validation/application';
import { csvCell, parseCsv, validateStudentRows } from '@/lib/validation/student';

describe('time zones', () => {
  it('reads academy wall-clock time as the right instant', () => {
    // Lagos is UTC+1 all year.
    expect(zonedToUtc('2026-03-14T16:30', 'Africa/Lagos')!.toISOString()).toBe('2026-03-14T15:30:00.000Z');
    expect(zonedToUtc('2026-01-01T00:00', 'Africa/Lagos')!.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });
  it('handles daylight-saving zones on both sides of a change', () => {
    expect(zonedToUtc('2026-01-15T09:00', 'Europe/London')!.toISOString()).toBe('2026-01-15T09:00:00.000Z'); // GMT
    expect(zonedToUtc('2026-07-15T09:00', 'Europe/London')!.toISOString()).toBe('2026-07-15T08:00:00.000Z'); // BST
    expect(zonedToUtc('2026-03-29T09:00', 'Europe/London')!.toISOString()).toBe('2026-03-29T08:00:00.000Z'); // the day clocks change
    expect(zonedToUtc('2026-11-01T09:00', 'America/New_York')!.toISOString()).toBe('2026-11-01T14:00:00.000Z');
  });
  it('round-trips between an instant and a datetime-local value', () => {
    for (const zone of ['Africa/Lagos', 'Europe/London', 'America/New_York', 'Asia/Kolkata']) {
      for (const local of ['2026-03-14T16:30', '2026-07-01T08:05', '2026-12-31T23:45']) {
        expect(utcToZonedInput(zonedToUtc(local, zone)!, zone), `${zone} ${local}`).toBe(local);
      }
    }
  });
  it('rejects malformed input', () => {
    expect(zonedToUtc('tomorrow', 'Africa/Lagos')).toBeNull();
    expect(zonedToUtc('', 'Africa/Lagos')).toBeNull();
  });
  it('works out calendar dates and weeks in the academy zone', () => {
    expect(zonedDate('2026-03-14T23:30:00Z', 'Africa/Lagos')).toBe('2026-03-15'); // already tomorrow in Lagos
    expect(weekStart('2026-03-15')).toBe('2026-03-09'); // Sunday belongs to the week starting Monday
    expect(weekStart('2026-03-09')).toBe('2026-03-09');
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('detects scheduling conflicts but not back-to-back lessons', () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 2, 14, h, m));
    expect(overlaps(at(15), 60, at(15, 30), 60)).toBe(true);
    expect(overlaps(at(15), 60, at(14, 30), 60)).toBe(true);
    expect(overlaps(at(15), 120, at(15, 30), 30)).toBe(true); // one inside the other
    expect(overlaps(at(15), 60, at(16), 60)).toBe(false); // back to back
    expect(overlaps(at(15), 60, at(17), 60)).toBe(false);
  });
});

describe('enrolment application validation', () => {
  const valid = {
    student_name: 'Ada Learner', student_dob: '2012-05-14', student_age: '', student_email: '', school_year: 'JSS2', curriculum: 'Nigerian', location: '',
    guardian_name: 'Parent Learner', guardian_email: 'Parent@Example.com ', guardian_phone: '0801 234 5678', guardian_relationship: 'mother',
    subjects: ['Junior Secondary Mathematics'], current_level: '', exam_target: '', delivery: 'online', preferred_times: '', challenges: '',
    strengths: '', desired_outcomes: '', notes: '', consent: true,
  };
  const errorsFor = (over: Record<string, unknown>) => {
    const r = applicationSchema.safeParse({ ...valid, ...over });
    return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
  };

  it('accepts a complete application and normalises it', () => {
    const r = applicationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.guardian_email).toBe('parent@example.com');
      expect(r.data.student_age).toBeNull();
      expect(r.data.student_email).toBeNull();
      expect(r.data.location).toBeNull();
    }
  });
  it('requires consent, a subject, a delivery choice and valid contact details', () => {
    expect(errorsFor({ consent: false })).toEqual(['consent']);
    expect(errorsFor({ subjects: [] })).toEqual(['subjects']);
    expect(errorsFor({ delivery: '' })).toContain('delivery');
    expect(errorsFor({ guardian_email: 'not-an-email' })).toEqual(['guardian_email']);
    expect(errorsFor({ guardian_phone: 'call me' })).toEqual(['guardian_phone']);
    expect(errorsFor({ student_name: '' })).toEqual(['student_name']);
  });
  it('needs a location only for home tutoring', () => {
    expect(errorsFor({ delivery: 'home', location: '' })).toEqual(['location']);
    expect(errorsFor({ delivery: 'home', location: 'Lekki Phase 1' })).toEqual([]);
  });
  it('rejects unknown subjects, future birth dates and a learner email equal to the parent’s', () => {
    expect(errorsFor({ subjects: ['Astrology'] })).toContain('subjects');
    expect(errorsFor({ student_dob: '2999-01-01' })).toEqual(['student_dob']);
    expect(errorsFor({ student_email: 'parent@example.com' })).toEqual(['student_email']);
    expect(errorsFor({ student_age: '200' })).toContain('student_age');
  });
  it('caps free-text length so oversized input is refused', () => {
    expect(errorsFor({ challenges: 'x'.repeat(1001) })).toEqual(['challenges']);
  });
});

describe('student CSV import', () => {
  it('parses quoted fields, embedded commas, escaped quotes and Windows line endings', () => {
    const rows = parseCsv('﻿full_name,email,location\r\n"Okafor, Ada",ada@example.com,"12 ""Main"" Rd"\r\n\r\nBola,bola@example.com,\n');
    expect(rows).toEqual([['full_name', 'email', 'location'], ['Okafor, Ada', 'ada@example.com', '12 "Main" Rd'], ['Bola', 'bola@example.com', '']]);
  });
  it('validates rows and reports each problem with its line number', () => {
    const { results, headerError } = validateStudentRows(parseCsv('Full Name,Email,Delivery\nAda,ada@example.com,ONLINE\n,missing@example.com,\nBola,not-an-email,\nCy,cy@example.com,spaceship'));
    expect(headerError).toBeUndefined();
    expect(results.map((r) => [r.line, r.errors.length > 0])).toEqual([[2, false], [3, true], [4, true], [5, true]]);
    expect(results[0]!.data.delivery).toBe('online');
  });
  it('detects duplicates inside the file and against existing accounts', () => {
    const { results } = validateStudentRows(parseCsv('full_name,email\nAda One,dup@example.com\nBola Two,DUP@example.com\nCy Three,taken@example.com'), ['Taken@Example.com']);
    expect(results[0]!.errors).toEqual([]);
    expect(results[1]!.errors).toContain('Duplicate email within this file');
    expect(results[2]!.errors).toContain('A student or account with this email already exists');
  });
  it('requires the full_name and email columns', () => {
    expect(validateStudentRows(parseCsv('name,mail\nA,a@example.com')).headerError).toMatch(/full_name and email/);
  });
  it('ignores unknown columns (a file cannot set role, billing or status)', () => {
    const { results } = validateStudentRows(parseCsv('full_name,email,role,hourly_rate_minor,status\nAda One,a@example.com,owner,1,active'));
    expect(Object.keys(results[0]!.data).sort()).toEqual(['email', 'full_name']);
  });
  it('neutralises spreadsheet formulas on export', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+234800')).toBe(`'+234800`);
    expect(csvCell('Okafor, Ada')).toBe('"Okafor, Ada"');
    expect(csvCell(null)).toBe('');
    expect(csvCell('plain')).toBe('plain');
  });
});
