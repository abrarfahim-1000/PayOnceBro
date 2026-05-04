// scripts/seed-test-users.js
// ────────────────────────────────────────────────────────────────────────
// Run ONCE before running the test suite for the first time.
//
//   npm run seed:test
//
// What it does:
//   - Creates (or refreshes) two Supabase auth users defined in .env.test:
//       1. TEST_USER_EMAIL       → main test user, role 'user'
//       2. TEST_FOREIGN_EMAIL    → second test user, role 'user'
//         (used to prove the ownership check on the tracking endpoints)
//   - Inserts matching profile rows in `profiles`.
//   - Idempotent: if the user already exists, it just updates the password.
//
// The whole point of this script is that the test suite never embeds a
// hardcoded credential. The credential lives only in .env.test (gitignored).
//
// NOTE on module syntax:
//   The PayOnceBro backend's package.json sets `"type": "module"`, so this
//   file uses ESM `import` syntax (not CommonJS `require`).
// ────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.test' });

const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function ensureUser(email, password, fullName) {
  // Try to look up the user first (idempotent path).
  const { data: list } = await adminDb.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);

  let userId;
  if (existing) {
    // Reset the password so the suite always has a known credential.
    const { error } = await adminDb.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = existing.id;
    console.log(`Refreshed user: ${email}`);
  } else {
    const { data, error } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created user:   ${email}`);
  }

  // Upsert into profiles so the app's queries find a row.
  const { error: profileErr } = await adminDb.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    role: 'user',
  });
  if (profileErr) throw profileErr;

  return userId;
}

try {
  await ensureUser(
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD,
    'Member 1 Test User'
  );
  await ensureUser(
    process.env.TEST_FOREIGN_EMAIL,
    process.env.TEST_FOREIGN_PASSWORD,
    'Foreign Test User'
  );
  console.log('\nSeed complete. You can now run: npm test');
  process.exit(0);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exit(1);
}
