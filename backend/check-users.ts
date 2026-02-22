import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log('\n=== USERS IN DATABASE ===\n');
  for (const user of users) {
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.fullName}`);
    console.log(`Role: ${user.role}`);
    console.log(`Active: ${user.isActive}`);
    console.log(`Password Hash: ${user.passwordHash.substring(0, 30)}...`);
    console.log(`ID: ${user.id}`);
    console.log('---');
  }
  console.log(`\nTotal users: ${users.length}\n`);
}

checkUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
