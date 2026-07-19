// scripts/create-admin-user.js
const { pool } = require('../src/db/pool');
const adminUserService = require('../src/services/adminUserService');

async function run() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin-user.js <email> <password>');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  try {
    const user = await adminUserService.createAdminUser(email, password);
    console.log(`Admin user created: ${user.email} (${user.id})`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error('An admin user with that email already exists.');
    } else {
      console.error('Failed to create admin user:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
