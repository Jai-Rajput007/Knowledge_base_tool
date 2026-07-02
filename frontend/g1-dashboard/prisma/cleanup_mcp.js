const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up invalid MCP entries...');
  const invalidNames = ['n8n Workflows', 'Metorial Control Plane', 'AIO-MCP', 'OpenTabs'];
  
  for (const name of invalidNames) {
    const res = await prisma.mcpIntegration.deleteMany({
      where: { name }
    });
    console.log(`Deleted ${res.count} records for ${name}`);
  }
}

main().finally(() => prisma.$disconnect());
