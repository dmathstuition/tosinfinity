// DEMONSTRATION DATA ONLY. For local development or a staging project.
// Never run against the live academy database.
//
//   node --env-file=.env.local scripts/seed-demo.mjs            add demo records
//   node --env-file=.env.local scripts/seed-demo.mjs --remove   remove them again
//
// Everything created is labelled "[DEMO]" and uses @demo.tosinfinity.test addresses
// (a reserved test domain that can never receive email). Rates and fees below are
// invented placeholders, not the academy's prices.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const remove = process.argv.includes('--remove');
const DOMAIN = '@demo.tosinfinity.test';

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}
if (!url || !serviceKey) stop('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
if (process.env.VERCEL_ENV === 'production' || process.env.ALLOW_DEMO_SEED === 'false') stop('Refusing to seed demo data in production.');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const must = async (promise, what) => {
  const { data, error } = await promise;
  if (error) stop(`${what} failed: ${error.message}`);
  return data;
};

const { data: owner } = await admin.from('profiles').select('id').eq('role', 'owner').maybeSingle();
if (!owner) stop('Create the Owner first: node --env-file=.env.local scripts/create-owner.mjs <email> "<name>"');

async function removeDemo() {
  const demo = await must(admin.from('profiles').select('id, role').like('email', `%${DOMAIN}`), 'Reading demo profiles');
  const ids = demo.map((p) => p.id);
  const students = demo.filter((p) => p.role === 'student').map((p) => p.id);
  if (students.length) {
    const invoices = await must(admin.from('invoices').select('id, status').in('student_id', students), 'Reading demo invoices');
    const issued = invoices.filter((i) => i.status !== 'draft');
    if (issued.length) {
      console.log(`  Note: ${issued.length} issued demo invoice(s) are financial records and are kept by design.`);
      console.log('  Their demo students are deactivated instead of deleted. Use a throwaway project for demos.');
    }
    await admin.from('invoices').delete().in('student_id', students).eq('status', 'draft');
  }
  await admin.from('classes').delete().like('title', '[DEMO]%');
  await admin.from('assignments').delete().like('title', '[DEMO]%');
  await admin.from('notices').delete().like('title', '[DEMO]%');
  await admin.from('blog_posts').delete().like('title', '[DEMO]%');
  for (const id of ids) {
    const { error } = await admin.from('profiles').delete().eq('id', id);
    if (error) await admin.from('profiles').update({ status: 'inactive' }).eq('id', id);
    else await admin.auth.admin.deleteUser(id);
  }
  console.log(`Removed demo data (${ids.length} demo account(s) processed).`);
}

if (remove) {
  await removeDemo();
  process.exit(0);
}

const existing = await must(admin.from('profiles').select('id').like('email', `%${DOMAIN}`).limit(1), 'Checking for demo data');
if (existing.length) stop('Demo data is already present. Remove it first with --remove.');

// Demo logins get a random password that is printed once below. They are not real people.
const password = `Demo-${randomBytes(6).toString('hex')}-1`;
async function login(email) {
  const data = await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), `Creating ${email}`);
  return data.user.id;
}

const students = [];
for (const [key, name, year, mode] of [['student.one', '[DEMO] Ada Example', 'JSS2', 'hourly'], ['student.two', '[DEMO] Bayo Example', 'SS1', 'flat_monthly']]) {
  const email = `${key}${DOMAIN}`;
  const id = await login(email);
  const code = await must(admin.rpc('create_student_profile', { p_user: id, p_email: email, p_fields: { full_name: name, school_year: year, curriculum: 'Nigerian', delivery: 'online', goals: 'Demonstration record' } }), 'Creating demo student');
  await must(admin.from('profiles').update(mode === 'hourly' ? { billing_mode: 'hourly', hourly_rate_minor: 100000 } : { billing_mode: 'flat_monthly', flat_fee_minor: 1000000 }).eq('id', id), 'Setting demo billing');
  students.push({ id, email, code, name });
}
const parentEmail = `parent.one${DOMAIN}`;
const parentId = await login(parentEmail);
for (const s of students) {
  await must(admin.rpc('link_parent', { p_parent_user: parentId, p_student: s.id, p_full_name: '[DEMO] Parent Example', p_email: parentEmail, p_phone: '', p_relationship: 'parent' }), 'Linking demo parent');
}

const programmes = await must(admin.from('programmes').select('id, slug').in('slug', ['junior-secondary-mathematics', 'senior-secondary-mathematics']), 'Reading programmes');
const programme = (slug) => programmes.find((p) => p.slug === slug)?.id ?? null;
await must(admin.from('student_enrolments').insert([
  { student_id: students[0].id, programme_id: programme('junior-secondary-mathematics') },
  { student_id: students[1].id, programme_id: programme('senior-secondary-mathematics') },
].filter((e) => e.programme_id)), 'Enrolling demo students');

const day = 86400000;
const at = (offsetDays, hourUtc) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};
const classes = await must(admin.from('classes').insert([
  { title: '[DEMO] JSS2 Mathematics: Algebra', starts_at: at(-7, 15), duration_minutes: 60, delivery: 'online', meeting_url: 'https://meet.jit.si/tosinfinity-demo-room', status: 'completed', objectives: 'Solve one-step linear equations' },
  { title: '[DEMO] JSS2 Mathematics: Fractions', starts_at: at(2, 15), duration_minutes: 60, delivery: 'online', meeting_url: 'https://meet.jit.si/tosinfinity-demo-room' },
  { title: '[DEMO] SS1 Mathematics: Quadratics', starts_at: at(3, 16), duration_minutes: 90, delivery: 'home', venue: 'Demo address (not real)' },
]).select('id, title'), 'Creating demo classes');
await must(admin.from('class_students').insert([
  { class_id: classes[0].id, student_id: students[0].id },
  { class_id: classes[1].id, student_id: students[0].id },
  { class_id: classes[2].id, student_id: students[1].id },
]), 'Adding demo students to classes');
await must(admin.from('attendance').insert({ class_id: classes[0].id, student_id: students[0].id, status: 'present', actual_minutes: 60, billable: true }), 'Recording demo attendance');

const assignments = await must(admin.from('assignments').insert([
  { title: '[DEMO] Linear equations worksheet', kind: 'written', instructions: 'Solve questions 1 to 10 and show your working.', max_marks: 20, due_at: at(4, 17), published: true, rubric: [{ criterion: 'Method shown', marks: 8 }, { criterion: 'Correct answers', marks: 12 }] },
  { title: '[DEMO] Fractions quick quiz', kind: 'quiz', instructions: 'Choose the best answer.', max_marks: 10, due_at: at(5, 17), published: true, allow_resubmission: true },
]).select('id, kind'), 'Creating demo assignments');
const quiz = assignments.find((a) => a.kind === 'quiz');
await must(admin.from('assignment_students').insert(assignments.map((a) => ({ assignment_id: a.id, student_id: students[0].id }))), 'Assigning demo work');
await must(admin.from('quiz_questions').insert([
  { assignment_id: quiz.id, position: 1, prompt: 'What is 1/2 + 1/4?', options: ['1/6', '3/4', '2/6', '1/8'], correct_index: 1, marks: 1 },
  { assignment_id: quiz.id, position: 2, prompt: 'Which fraction is equal to 0.5?', options: ['1/5', '5/1', '1/2', '2/5'], correct_index: 2, marks: 1 },
]), 'Creating demo quiz questions');

await must(admin.from('notices').insert({ title: '[DEMO] Welcome to the portal', body: 'This is a demonstration announcement.', audience: 'everyone', published_at: new Date().toISOString() }), 'Creating demo notice');
await must(admin.from('blog_posts').insert({
  slug: `demo-article-${randomBytes(3).toString('hex')}`, title: '[DEMO] Five ways to revise for a Mathematics test', excerpt: 'A demonstration article. Replace or delete before launch.',
  body_md: '## Demonstration article\n\nThis article is sample content.\n\n- Practise little and often\n- Check your working\n- Ask questions early',
  category: 'Study tips', status: 'draft',
}), 'Creating demo article');

console.log('\nDemo data created. Everything is labelled [DEMO].\n');
console.log('Demo sign-ins (local/staging only):');
for (const s of students) console.log(`  Student  ${s.email}   (ID ${s.code})`);
console.log(`  Parent   ${parentEmail}   (linked to both demo students)`);
console.log(`\n  Password for all demo accounts: ${password}`);
console.log('  It is shown only now and is not stored anywhere else.\n');
console.log('Remove everything with: node --env-file=.env.local scripts/seed-demo.mjs --remove\n');
