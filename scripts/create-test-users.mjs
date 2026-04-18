import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `test-user-${i + 1}@familyflow.test`,
    password: 'TestPassword123!',
  })),
  { email: 'test-simple@familyflow.test', password: 'password123' },
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'viewer@example.com', password: 'password123' },
  { email: 'viewer-user@familyflow.test', password: 'testpassword123' },
  { email: 'goals-canonical@test.familyflow', password: 'TestPassword123!' },
];

async function listAllUsers(perPage = 200) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

let existingUsers;

try {
  existingUsers = await listAllUsers();
} catch (error) {
  console.error('Failed to list users:', error.message);
  process.exit(1);
}

const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));

for (const target of users) {
  const existing = existingByEmail.get(target.email);

  if (!existing) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: target.email,
      password: target.password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('already been registered')) {
        console.log(`= already exists: ${target.email}`);
        continue;
      }

      console.error(`x failed to create ${target.email}: ${createError.message}`);
      continue;
    }

    console.log(`+ created: ${target.email}`);
    continue;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password: target.password,
    email_confirm: true,
  });

  if (updateError) {
    console.error(`x failed to update ${target.email}: ${updateError.message}`);
    continue;
  }

  console.log(`= ensured: ${target.email}`);
}

console.log('Done.');
