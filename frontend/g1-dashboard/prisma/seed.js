const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const tenant = await prisma.tenant.upsert({
    where:  { id: 'default-tenant' },
    update: {},
    create: {
      id:       'default-tenant',
      name:     'G1 Robot Dashboard',
      features: JSON.stringify({ personas: true, rag: true, frs: true }),
    },
  });

  await prisma.user.upsert({
    where:  { email: 'admin@g1system.local' },
    update: {},
    create: {
      email:    'admin@g1system.local',
      password: 'admin123',
      name:     'Admin',
      role:     'SUPER_ADMIN',
    },
  });

  await prisma.user.upsert({
    where:  { email: 'client@g1system.local' },
    update: {},
    create: {
      email:    'client@g1system.local',
      password: 'client123',
      name:     'Client User',
      role:     'CLIENT',
      tenantId: tenant.id,
    },
  });

  console.log('Done.');
  console.log('  admin@g1system.local  / admin123  (SUPER_ADMIN)');
  console.log('  client@g1system.local / client123 (CLIENT)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
