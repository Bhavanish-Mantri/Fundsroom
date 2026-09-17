require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed Products
  console.log('Seeding products...');
  const productSeed = [
    { productCode: 'P-1001', name: 'Hydraulic Valve', category: 'Pneumatics', unit: 'PCS', basePrice: 4200.00 },
    { productCode: 'P-1002', name: 'Industrial Motor', category: 'Electrical', unit: 'PCS', basePrice: 18500.00 },
    { productCode: 'P-1003', name: 'Steel Gearbox', category: 'Mechanical', unit: 'PCS', basePrice: 9600.00 },
    { productCode: 'P-1004', name: 'Pressure Sensor', category: 'Instrumentation', unit: 'PCS', basePrice: 3200.00 },
    { productCode: 'P-1005', name: 'Conveyor Belt', category: 'Material Handling', unit: 'MTR', basePrice: 650.00 },
    { productCode: 'P-1006', name: 'Bearing Kit', category: 'Mechanical', unit: 'SET', basePrice: 2100.00 },
  ];

  const createdProducts = [];
  for (const product of productSeed) {
    const row = await prisma.product.upsert({
      where: { productCode: product.productCode },
      update: {
        name: product.name,
        category: product.category,
        unit: product.unit,
        basePrice: product.basePrice,
      },
      create: product,
    });
    createdProducts.push(row);
  }
  console.log(`Seeded ${createdProducts.length} products.`);

  // 2. Seed Inventory
  console.log('Seeding inventory...');
  const qtyMap = {
    'P-1001': 120,
    'P-1002': 60,
    'P-1003': 80,
    'P-1004': 150,
    'P-1005': 200,
    'P-1006': 100,
  };

  for (const product of createdProducts) {
    const physicalQty = qtyMap[product.productCode] || 100;
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        physicalQty,
        reservedQty: 0,
      },
      create: {
        productId: product.id,
        physicalQty,
        reservedQty: 0,
      },
    });
  }
  console.log(`Seeded inventory for ${createdProducts.length} products.`);

  // 3. Seed Users with hashed passwords
  console.log('Seeding users...');
  const [adminPassword, salesPassword] = await Promise.all([
    bcrypt.hash('Admin@123', 10),
    bcrypt.hash('Sales@123', 10),
  ]);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mini.erp' },
    update: { passwordHash: adminPassword, role: 'ADMIN' },
    create: {
      name: 'System Administrator',
      email: 'admin@mini.erp',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@mini.erp' },
    update: { passwordHash: salesPassword, role: 'SALES_USER' },
    create: {
      name: 'Sales User',
      email: 'sales@mini.erp',
      passwordHash: salesPassword,
      role: 'SALES_USER',
    },
  });
  console.log(`Seeded users: ${adminUser.email} (ADMIN), ${salesUser.email} (SALES_USER).`);

  // 4. Seed Customers
  console.log('Seeding customers...');
  const customers = [
    {
      companyName: 'Alpha Manufacturing',
      contactPerson: 'Ravi Sharma',
      mobile: '+91-9876543210',
      email: 'sales@alphamfg.com',
      city: 'Pune',
    },
    {
      companyName: 'Orbit Components',
      contactPerson: 'Neha Verma',
      mobile: '+91-9823456789',
      email: 'procurement@orbitcomponents.com',
      city: 'Bengaluru',
    },
    {
      companyName: 'Apex Heavy Industries',
      contactPerson: 'Rajesh Patil',
      mobile: '+91-9812345678',
      email: 'procurement@apexheavy.com',
      city: 'Ahmedabad',
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { companyName_email: { companyName: c.companyName, email: c.email } },
      update: c,
      create: c,
    });
  }
  console.log(`Seeded ${customers.length} customers.`);

  console.log('--- Seed data inserted successfully ---');
}

main()
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
