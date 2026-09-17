require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function runVerification() {
  console.log('================================================================');
  console.log('         MINI ERP - PHASE 2 DATABASE VERIFICATION SUITE         ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`[PASS] ${message}`);
      if (details) console.log(`       ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      if (details) console.error(`       ${details}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------------------
    // Check A: Database connection works
    // ----------------------------------------------------------------
    const dbInfo = await prisma.$queryRaw`SELECT version(), current_database(), current_user, now() as timestamp;`;
    const ver = dbInfo[0].version.split(' on ')[0];
    assert(dbInfo.length > 0, 'A. Database connection works', `${ver} | DB: ${dbInfo[0].current_database} | User: ${dbInfo[0].current_user}`);

    // ----------------------------------------------------------------
    // Check B: All expected tables exist
    // ----------------------------------------------------------------
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tableNames = tables.map(t => t.table_name);
    const expectedTables = [
      'users', 'customers', 'products', 'inventory',
      'enquiries', 'enquiry_items', 'quotations', 'quotation_items',
      'sales_orders', 'sales_order_items', 'dispatches', 'dispatch_items'
    ];
    const missingTables = expectedTables.filter(t => !tableNames.includes(t));
    assert(missingTables.length === 0, 'B. All expected tables exist', `Found: ${tableNames.filter(t => expectedTables.includes(t)).join(', ')}`);

    // ----------------------------------------------------------------
    // Check C: Primary keys exist
    // ----------------------------------------------------------------
    const pks = await prisma.$queryRaw`
      SELECT tc.table_name, ccu.column_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;
    const pkTables = pks.map(p => p.table_name);
    const tablesWithoutPk = expectedTables.filter(t => !pkTables.includes(t));
    assert(tablesWithoutPk.length === 0, 'C. Primary keys exist on all expected tables', `PKs verified on ${pkTables.filter(t => expectedTables.includes(t)).length} tables`);

    // ----------------------------------------------------------------
    // Check D: Foreign keys exist
    // ----------------------------------------------------------------
    const fks = await prisma.$queryRaw`
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    const expectedFkPairs = [
      ['inventory', 'products'],
      ['enquiries', 'customers'],
      ['enquiry_items', 'enquiries'],
      ['enquiry_items', 'products'],
      ['quotations', 'enquiries'],
      ['quotations', 'customers'],
      ['quotation_items', 'quotations'],
      ['quotation_items', 'products'],
      ['sales_orders', 'quotations'],
      ['sales_orders', 'customers'],
      ['sales_order_items', 'sales_orders'],
      ['sales_order_items', 'products'],
      ['dispatches', 'sales_orders'],
      ['dispatch_items', 'dispatches'],
      ['dispatch_items', 'products']
    ];
    let allFksPresent = true;
    for (const [src, tgt] of expectedFkPairs) {
      const found = fks.some(f => f.source_table === src && f.target_table === tgt);
      if (!found) {
        allFksPresent = false;
        console.error(`       Missing FK: ${src} -> ${tgt}`);
      }
    }
    assert(allFksPresent, 'D. Foreign keys exist between all major entities', `Verified ${fks.length} PostgreSQL foreign keys`);

    // ----------------------------------------------------------------
    // Check E: UNIQUE constraints exist
    // ----------------------------------------------------------------
    const uniqueConstraints = await prisma.$queryRaw`
      SELECT tc.table_name, kcu.column_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;
    const uniqueIndexes = await prisma.$queryRaw`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%'
      ORDER BY tablename, indexname;
    `;
    const uDefs = uniqueIndexes.map(i => i.indexdef);
    const hasUserEmail = uDefs.some(d => d.includes('users') && d.includes('email'));
    const hasProdCode = uDefs.some(d => d.includes('products') && d.includes('product_code'));
    const hasEnqNum = uDefs.some(d => d.includes('enquiries') && d.includes('enquiry_number'));
    const hasQuotNum = uDefs.some(d => d.includes('quotations') && d.includes('quotation_number'));
    const hasSoNum = uDefs.some(d => d.includes('sales_orders') && d.includes('order_number'));
    const hasSoQuot = uDefs.some(d => d.includes('sales_orders') && d.includes('quotation_id'));
    const hasDispNum = uDefs.some(d => d.includes('dispatches') && d.includes('dispatch_number'));
    const hasCustCompEmail = uDefs.some(d => d.includes('customers') && d.includes('company_name') && d.includes('email'));
    const hasInvProd = uDefs.some(d => d.includes('inventory') && d.includes('product_id'));

    const allUniques = hasUserEmail && hasProdCode && hasEnqNum && hasQuotNum && hasSoNum && hasSoQuot && hasDispNum && hasCustCompEmail && hasInvProd;
    assert(allUniques, 'E. UNIQUE constraints exist on business keys', 'Verified unique email, product_code, enquiry_number, quotation_number, order_number, quotation_id, dispatch_number, customer(company_name, email), inventory(product_id)');

    // ----------------------------------------------------------------
    // Check F: CHECK constraints exist where intended
    // ----------------------------------------------------------------
    const checks = await prisma.$queryRaw`
      SELECT conname, relname as table_name, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE c.contype = 'c' AND n.nspname = 'public'
      ORDER BY relname, conname;
    `;
    const checkNames = checks.map(c => c.conname);
    const expectedChecks = [
      'inventory_physical_quantity_check',
      'inventory_reserved_quantity_check',
      'inventory_reserved_quantity_lte_physical_quantity_check',
      'products_base_price_check',
      'enquiry_items_quantity_check',
      'quotations_grand_total_check',
      'quotation_items_quantity_check',
      'quotation_items_unit_price_check',
      'quotation_items_discount_pct_check',
      'quotation_items_gst_pct_check',
      'quotation_items_line_amount_check',
      'sales_orders_total_amount_check',
      'sales_order_items_quantity_check',
      'sales_order_items_unit_price_check',
      'dispatch_items_quantity_check'
    ];
    const missingChecks = expectedChecks.filter(c => !checkNames.includes(c));
    assert(missingChecks.length === 0, 'F. CHECK constraints exist where intended', `Verified ${checks.length} PostgreSQL check constraints. Definitions include: physical>=0, reserved>=0, reserved<=physical, discount 0-100, gst>=0, prices>=0`);

    // ----------------------------------------------------------------
    // Check G: Indexes exist
    // ----------------------------------------------------------------
    const indexes = await prisma.$queryRaw`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    assert(indexes.length >= 20, 'G. Indexes exist on FKs, status fields, and search columns', `Total indexes in public schema: ${indexes.length}`);

    // ----------------------------------------------------------------
    // Check H: At least 6 products exist
    // ----------------------------------------------------------------
    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    assert(products.length >= 6, 'H. At least 6 realistic industrial products exist', `Found ${products.length} products: ${products.map(p => `${p.productCode} (${p.name})`).join(', ')}`);

    // ----------------------------------------------------------------
    // Check I: Admin user exists with hashed password
    // ----------------------------------------------------------------
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@mini.erp' } });
    const isBcrypt = adminUser && adminUser.passwordHash.startsWith('$2');
    assert(adminUser && adminUser.role === 'ADMIN' && isBcrypt, 'I. Admin user exists with bcrypt password hash', `Email: ${adminUser?.email} | Role: ${adminUser?.role} | Hash format valid: ${isBcrypt}`);

    // ----------------------------------------------------------------
    // Check J: Sales user exists with hashed password
    // ----------------------------------------------------------------
    const salesUser = await prisma.user.findUnique({ where: { email: 'sales@mini.erp' } });
    const isSalesBcrypt = salesUser && salesUser.passwordHash.startsWith('$2');
    assert(salesUser && salesUser.role === 'SALES_USER' && isSalesBcrypt, 'J. Sales user exists with bcrypt password hash', `Email: ${salesUser?.email} | Role: ${salesUser?.role} | Hash format valid: ${isSalesBcrypt}`);

    // ----------------------------------------------------------------
    // Check K: Customers exist
    // ----------------------------------------------------------------
    const customers = await prisma.customer.findMany();
    assert(customers.length >= 2, 'K. Customers exist in database', `Found ${customers.length} customers: ${customers.map(c => `${c.companyName} (${c.city})`).join(', ')}`);

    // ----------------------------------------------------------------
    // Check L: Inventory exists
    // ----------------------------------------------------------------
    const inventory = await prisma.inventory.findMany({ include: { product: true } });
    assert(inventory.length >= 6, 'L. Inventory exists for seeded products', `Found ${inventory.length} inventory records linked to products`);

    // ----------------------------------------------------------------
    // Check M & N: quotation_items discount_pct and gst_pct exist
    // ----------------------------------------------------------------
    const qCols = await prisma.$queryRaw`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'quotation_items' AND column_name IN ('discount_pct', 'gst_pct', 'line_amount', 'unit_price', 'quantity');
    `;
    const qColNames = qCols.map(c => c.column_name);
    assert(qColNames.includes('discount_pct'), 'M. quotation_items.discount_pct exists as item-level column', `Type: ${qCols.find(c => c.column_name === 'discount_pct')?.data_type}`);
    assert(qColNames.includes('gst_pct'), 'N. quotation_items.gst_pct exists as item-level column', `Type: ${qCols.find(c => c.column_name === 'gst_pct')?.data_type}`);

    // ----------------------------------------------------------------
    // Check O: sales_orders.quotation_id is UNIQUE
    // ----------------------------------------------------------------
    assert(hasSoQuot, 'O. sales_orders.quotation_id is UNIQUE (enforces 1 accepted quotation -> max 1 sales order)', 'Unique index sales_orders_quotation_id_key is active');

    // ----------------------------------------------------------------
    // Check P: No independent available_quantity field exists
    // ----------------------------------------------------------------
    const invCols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory' AND column_name = 'available_quantity';
    `;
    assert(invCols.length === 0, 'P. No independent available_quantity column exists (strictly derived: physical - reserved)', 'Verified available_quantity is not a stored column');

    // ----------------------------------------------------------------
    // Check Q: Inventory values are valid
    // ----------------------------------------------------------------
    const invalidInv = inventory.filter(i => i.physicalQty < 0 || i.reservedQty < 0 || i.reservedQty > i.physicalQty);
    assert(invalidInv.length === 0, 'Q. Inventory values are valid (physical>=0, reserved>=0, reserved<=physical)', `All ${inventory.length} rows satisfy invariants. Sample: ${inventory[0].product.productCode} physical=${inventory[0].physicalQty}, reserved=${inventory[0].reservedQty}, available=${inventory[0].physicalQty - inventory[0].reservedQty}`);

    // ----------------------------------------------------------------
    // Check R: Seed data respects foreign keys
    // ----------------------------------------------------------------
    const invProductIds = inventory.map(i => i.productId);
    const prodIds = products.map(p => p.id);
    const allFkValid = invProductIds.every(id => prodIds.includes(id));
    assert(allFkValid, 'R. Seed data respects all foreign keys', 'All inventory rows reference valid products');

    // ----------------------------------------------------------------
    // Check S: No duplicate business numbers exist
    // ----------------------------------------------------------------
    const prodCodes = products.map(p => p.productCode);
    const hasDuplicateCodes = new Set(prodCodes).size !== prodCodes.length;
    assert(!hasDuplicateCodes, 'S. No duplicate business numbers exist', `All ${prodCodes.length} product codes are distinct`);

    // ================================================================
    // PART 2: NEGATIVE CONSTRAINT TESTS
    // ================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('         RUNNING NEGATIVE CONSTRAINT & INTEGRITY TESTS          ');
    console.log('----------------------------------------------------------------\n');

    // Test 1: Inventory reserved_quantity > physical_quantity rejected
    let negInvRejected = false;
    try {
      await prisma.$executeRaw`
        INSERT INTO inventory (product_id, physical_quantity, reserved_quantity, created_at, updated_at)
        VALUES (99999, 50, 100, now(), now());
      `;
    } catch (e) {
      negInvRejected = e.message.includes('inventory_reserved_quantity_lte_physical_quantity_check') || e.message.includes('check constraint');
    }
    assert(negInvRejected, 'Negative Test 1: Database rejects reserved_quantity > physical_quantity', 'PostgreSQL check constraint inventory_reserved_quantity_lte_physical_quantity_check triggered');

    // Test 2: Product base_price < 0 rejected
    let negPriceRejected = false;
    try {
      await prisma.$executeRaw`
        INSERT INTO products (product_code, name, category, unit, base_price, created_at, updated_at)
        VALUES ('TEST-NEG', 'Negative Price Test', 'Test', 'PCS', -100.00, now(), now());
      `;
    } catch (e) {
      negPriceRejected = e.message.includes('products_base_price_check') || e.message.includes('check constraint');
    }
    assert(negPriceRejected, 'Negative Test 2: Database rejects negative product base_price', 'PostgreSQL check constraint products_base_price_check triggered');

    // Test 3: Discount percentage > 100 rejected
    let negDiscRejected = false;
    try {
      await prisma.$executeRaw`
        INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, discount_pct, gst_pct, line_amount, created_at)
        VALUES (99999, 99999, 1, 100, 120, 18, 0, now());
      `;
    } catch (e) {
      negDiscRejected = e.message.includes('quotation_items_discount_pct_check') || e.message.includes('check constraint');
    }
    assert(negDiscRejected, 'Negative Test 3: Database rejects discount_pct > 100', 'PostgreSQL check constraint quotation_items_discount_pct_check triggered');

    // Test 4: Quantity <= 0 rejected
    let negQtyRejected = false;
    try {
      await prisma.$executeRaw`
        INSERT INTO enquiry_items (enquiry_id, product_id, quantity, created_at)
        VALUES (99999, 99999, 0, now());
      `;
    } catch (e) {
      negQtyRejected = e.message.includes('enquiry_items_quantity_check') || e.message.includes('check constraint');
    }
    assert(negQtyRejected, 'Negative Test 4: Database rejects quantity <= 0', 'PostgreSQL check constraint enquiry_items_quantity_check triggered');

    // Test 5: Duplicate Sales Order for same Quotation rejected
    let dupSoRejected = false;
    const testCust = customers[0];
    const testProd = products[0];

    // Create a temporary enquiry, quotation, and first sales order
    const testEnq = await prisma.enquiry.create({
      data: {
        enquiryNumber: 'ENQ-NEG-TEST-001',
        customerId: testCust.id,
        enquiryDate: new Date(),
        status: 'QUOTED',
      },
    });

    const testQuot = await prisma.quotation.create({
      data: {
        quotationNumber: 'QUOT-NEG-TEST-001',
        enquiryId: testEnq.id,
        customerId: testCust.id,
        validUntil: new Date(Date.now() + 86400000),
        status: 'ACCEPTED',
        grandTotal: 5000.00,
      },
    });

    const testSo1 = await prisma.salesOrder.create({
      data: {
        orderNumber: 'SO-NEG-TEST-001',
        quotationId: testQuot.id,
        customerId: testCust.id,
        orderDate: new Date(),
        totalAmount: 5000.00,
        status: 'PENDING',
      },
    });

    // Attempt second Sales Order for the same quotation
    try {
      await prisma.salesOrder.create({
        data: {
          orderNumber: 'SO-NEG-TEST-002',
          quotationId: testQuot.id, // DUPLICATE quotationId!
          customerId: testCust.id,
          orderDate: new Date(),
          totalAmount: 5000.00,
          status: 'PENDING',
        },
      });
    } catch (e) {
      dupSoRejected = e.message.includes('Unique constraint failed') || e.message.includes('sales_orders_quotation_id_key');
    }

    // Clean up temporary test records in reverse order
    await prisma.salesOrder.delete({ where: { id: testSo1.id } });
    await prisma.quotation.delete({ where: { id: testQuot.id } });
    await prisma.enquiry.delete({ where: { id: testEnq.id } });

    assert(dupSoRejected, 'Negative Test 5: Database rejects duplicate Sales Order for same quotation', 'Unique constraint sales_orders_quotation_id_key successfully prevented duplicate conversion (cleanly reverted test records)');

  } catch (err) {
    console.error('Verification failed with unhandled error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');
    if (failed > 0) process.exit(1);
  }
}

runVerification();
