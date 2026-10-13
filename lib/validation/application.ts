import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => v || null);

export const SUBJECT_OPTIONS = [
  'Primary Mathematics', 'Junior Secondary Mathematics', 'Senior Secondary Mathematics', 'IGCSE Mathematics',
  'SAT Mathematics Foundation', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology',
] as const;
export const EXAM_OPTIONS = ['None', 'WAEC', 'IGCSE', 'UTME', 'SAT'] as const;
export const CURRICULUM_OPTIONS = ['Nigerian', 'British (IGCSE)', 'American', 'Other'] as const;

/** Shared by the client form (step validation) and the server action (authoritative). */
export const applicationSchema = z
  .object({
    student_name: text(120).min(2, 'Enter the learner’s full name'),
    student_dob: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v) < new Date()), 'Enter a valid date of birth'),
    student_age: z
      .union([z.literal(''), z.coerce.number().int().min(3, 'Enter a valid age').max(99, 'Enter a valid age')])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    student_email: z
      .union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address').max(254)])
      .optional()
      .transform((v) => v || null),
    school_year: text(60).min(1, 'Enter the current class or school year'),
    curriculum: optionalText(60),
    location: optionalText(200),

    guardian_name: text(120).min(2, 'Enter the parent or guardian’s full name'),
    guardian_email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
    guardian_phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
    guardian_relationship: text(40).min(2, 'Tell us your relationship to the learner'),

    subjects: z.array(z.enum(SUBJECT_OPTIONS)).min(1, 'Choose at least one subject').max(9),
    current_level: optionalText(300),
    exam_target: optionalText(40),
    delivery: z.enum(['home', 'online'], { errorMap: () => ({ message: 'Choose home or online tutoring' }) }),
    preferred_times: optionalText(300),
    challenges: optionalText(1000),
    strengths: optionalText(1000),
    desired_outcomes: optionalText(1000),
    notes: optionalText(1000),

    consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm to continue' }) }),
  })
  .refine((d) => d.delivery !== 'home' || Boolean(d.location), {
    path: ['location'],
    message: 'Enter the area or address for home tutoring',
  })
  .refine((d) => !d.student_email || d.student_email !== d.guardian_email, {
    path: ['student_email'],
    message: 'The learner’s email must be different from the parent’s email. Leave it blank if they do not have one.',
  });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationData = z.output<typeof applicationSchema>;

/** Field names per form step, used for step-by-step validation. */
export const APPLICATION_STEPS = [
  { title: 'The learner', fields: ['student_name', 'student_dob', 'student_age', 'student_email', 'school_year', 'curriculum'] },
  { title: 'Parent or guardian', fields: ['guardian_name', 'guardian_email', 'guardian_phone', 'guardian_relationship'] },
  { title: 'Learning needs', fields: ['subjects', 'current_level', 'exam_target', 'delivery', 'location', 'preferred_times'] },
  { title: 'Goals and consent', fields: ['challenges', 'strengths', 'desired_outcomes', 'notes', 'consent'] },
] as const;
