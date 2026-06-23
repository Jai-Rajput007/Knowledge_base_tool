import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create G1 Universe tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'G1 Universe',
      features: {
        analytics: true,
        custom_personas: true,
        advanced_ai: false
      }
    }
  });

  console.log(`Created Tenant: ${tenant.name}`);

  // Create Super Admin
  await prisma.user.create({
    data: {
      email: 'admin@g1platform.com',
      password: 'Admin@123', // Raw password for demo. We'll add bcrypt later!
      name: 'Platform Admin',
      role: 'SUPER_ADMIN'
    }
  });

  // Create Client
  await prisma.user.create({
    data: {
      email: 'client@g1universe.com',
      password: 'Client@123',
      name: 'Sarah Chen',
      role: 'CLIENT',
      tenantId: tenant.id
    }
  });

  // Create Viewer
  await prisma.user.create({
    data: {
      email: 'viewer@g1universe.com',
      password: 'Viewer@123',
      name: 'Alex Rivera',
      role: 'VIEWER',
      tenantId: tenant.id
    }
  });

  console.log('Successfully seeded Super Admin, Client, and Viewer!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
