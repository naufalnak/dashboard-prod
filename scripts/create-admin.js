require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/db');

async function main() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Usage: node scripts/create-admin.js <username> <password>');
    console.error('   or set ADMIN_USERNAME / ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Admin account ready: ${admin.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
