// Creates the single Owner account. Run once after the database migrations:
//
//   node --env-file=.env.local scripts/create-owner.mjs you@example.com "Your Full Name"
//
// No password is set here. The script prints a single-use link; open it to choose
// your password. Uses the service-role key from your environment and never stores it.
import { createClient } from '@supabase/supabase-js';

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ').trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) stop('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/create-owner.mjs <email> "<full name>"');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || fullName.length < 2) stop('Usage: node --env-file=.env.local scripts/create-owner.mjs <email> "<full name>"');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existingOwner, error: readError } = await admin.from('profiles').select('email').eq('role', 'owner').maybeSingle();
if (readError) stop(`Could not read the database. Have the migrations been applied? (${readError.message})`);
if (existingOwner) stop(`An Owner already exists (${existingOwner.email}). This academy has exactly one Owner.`);

const address = email.trim().toLowerCase();
let userId;
const { data: found } = await admin.rpc('auth_user_id_by_email', { p_email: address });
if (typeof found === 'string') {
  const { data: profile } = await admin.from('profiles').select('role').eq('id', found).maybeSingle();
  if (profile) stop(`${address} already belongs to a ${profile.role} account. Use a different email for the Owner.`);
  userId = found;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email: address, email_confirm: true });
  if (error || !data.user) stop(`Could not create the login: ${error?.message ?? 'unknown error'}`);
  userId = data.user.id;
}

const { error: profileError } = await admin.from('profiles').insert({ id: userId, role: 'owner', full_name: fullName, email: address });
if (profileError) stop(`Could not create the Owner profile: ${profileError.message}`);

const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email: address });
if (linkError || !link?.properties?.hashed_token) stop('Owner created, but a password link could not be generated. Use "Forgot password" on the sign-in page.');

console.log(`\nOwner account created for ${address}.`);
console.log('\nOpen this single-use link to choose your password (it expires, so use it now):\n');
console.log(`  ${site}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}\n`);
console.log('Then sign in at /login and turn on two-step verification under Settings → Security.\n');
