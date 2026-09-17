require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');

async function runE2E() {
  console.log('====================================================');
  console.log('STARTING 18-STEP REAL END-TO-END ACCEPTANCE WORKFLOW');
  console.log('====================================================\n');

  let salesToken = null;
  let adminToken = null;
  let customer = null;
  let products = [];
  let enquiry = null;
  let quotation = null;
  let salesOrder = null;
  let invBeforeConfirm = null;

  try {
    // ----------------------------------------------------
    // STEP 1: Login as SALES_USER
    // ----------------------------------------------------
    console.log('Step 1: Logging in as SALES_USER (sales@mini.erp)...');
    const salesLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sales@mini.erp', password: 'Sales@123' });
    
    if (salesLoginRes.status !== 200 || !salesLoginRes.body.token) {
      throw new Error(`Step 1 FAILED: Status ${salesLoginRes.status}, error: ${JSON.stringify(salesLoginRes.body)}`);
    }
    salesToken = salesLoginRes.body.token;
    console.log(`[PASS] Step 1: SALES_USER authenticated successfully. Role: ${salesLoginRes.body.user.role}\n`);

    // ----------------------------------------------------
    // STEP 2: Create / Select Customer
    // ----------------------------------------------------
    console.log('Step 2: Creating a new customer as SALES_USER...');
    const custPayload = {
      companyName: `E2E Tech Industries ${Date.now()}`,
      contactPerson: 'Rajesh Sharma',
      email: `rajesh.${Date.now()}@e2etech.com`,
      mobile: '+91 98765 43210',
      city: 'Pune',
    };
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(custPayload);

    if (custRes.status !== 201 || !custRes.body.id) {
      throw new Error(`Step 2 FAILED: Status ${custRes.status}, error: ${JSON.stringify(custRes.body)}`);
    }
    customer = custRes.body;
    console.log(`[PASS] Step 2: Customer created with ID ${customer.id} (${customer.companyName})\n`);

    // Load 2 products to test multi-product enquiry
    products = await prisma.product.findMany({ take: 2, orderBy: { id: 'asc' } });
    if (products.length < 2) {
      throw new Error('Step 2 FAILED: Need at least 2 seeded products.');
    }

    // ----------------------------------------------------
    // STEP 3: Create multi-product enquiry
    // ----------------------------------------------------
    console.log(`Step 3: Creating multi-product enquiry with 2 products (${products[0].productCode}, ${products[1].productCode})...`);
    const enqPayload = {
      customerId: customer.id,
      notes: 'Urgent requirement for assembly line expansion',
      items: [
        { productId: products[0].id, quantity: 3 },
        { productId: products[1].id, quantity: 2 },
      ],
    };
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(enqPayload);

    if (enqRes.status !== 201 || !enqRes.body.id) {
      throw new Error(`Step 3 FAILED: Status ${enqRes.status}, error: ${JSON.stringify(enqRes.body)}`);
    }
    enquiry = enqRes.body;
    console.log(`[PASS] Step 3: Enquiry created: ${enquiry.enquiryNumber} with ${enquiry.items.length} items. Status: ${enquiry.status}\n`);

    // ----------------------------------------------------
    // STEP 4: Create quotation
    // ----------------------------------------------------
    console.log('Step 4: Creating quotation from enquiry with discounts & GST...');
    // Item 1: Qty 3 @ 5000, 10% disc, 18% gst -> base 15000, disc 1500, after 13500, gst 2430 -> 15930
    // Item 2: Qty 2 @ 10000, 5% disc, 18% gst -> base 20000, disc 1000, after 19000, gst 3420 -> 22420
    // Grand total expected: 15930 + 22420 = 38350
    const quotPayload = {
      enquiryId: enquiry.id,
      notes: 'Net 30 payment terms',
      items: [
        { productId: products[0].id, quantity: 3, unitPrice: 5000, discountPct: 10, gstPct: 18 },
        { productId: products[1].id, quantity: 2, unitPrice: 10000, discountPct: 5, gstPct: 18 },
      ],
    };
    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(quotPayload);

    if (quotRes.status !== 201 || !quotRes.body.id) {
      throw new Error(`Step 4 FAILED: Status ${quotRes.status}, error: ${JSON.stringify(quotRes.body)}`);
    }
    quotation = quotRes.body;
    console.log(`[PASS] Step 4: Quotation created: ${quotation.quotationNumber}. Status: ${quotation.status}\n`);

    // ----------------------------------------------------
    // STEP 5: Verify backend-calculated totals
    // ----------------------------------------------------
    console.log('Step 5: Verifying backend calculated financial values...');
    const item1 = quotation.items.find((i) => i.productId === products[0].id);
    const item2 = quotation.items.find((i) => i.productId === products[1].id);

    console.log(`- Item 1 Line Amount: ${item1.lineAmount} (Expected 15930)`);
    console.log(`- Item 2 Line Amount: ${item2.lineAmount} (Expected 22420)`);
    console.log(`- Grand Total: ${quotation.grandTotal} (Expected 38350)`);

    if (Number(item1.lineAmount) !== 15930 || Number(item2.lineAmount) !== 22420 || Number(quotation.grandTotal) !== 38350) {
      throw new Error(`Step 5 FAILED: Incorrect financial totals. Received grandTotal=${quotation.grandTotal}`);
    }
    console.log('[PASS] Step 5: Backend financial calculation strictly verified.\n');

    // ----------------------------------------------------
    // STEP 6: Change quotation to SENT
    // ----------------------------------------------------
    console.log('Step 6: Updating quotation status to SENT...');
    const sentRes = await request(app)
      .patch(`/api/quotations/${quotation.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    if (sentRes.status !== 200 || sentRes.body.status !== 'SENT') {
      throw new Error(`Step 6 FAILED: Status ${sentRes.status}, error: ${JSON.stringify(sentRes.body)}`);
    }
    console.log(`[PASS] Step 6: Quotation status updated to ${sentRes.body.status}\n`);

    // ----------------------------------------------------
    // STEP 7: Change quotation to ACCEPTED
    // ----------------------------------------------------
    console.log('Step 7: Updating quotation status to ACCEPTED...');
    const acceptRes = await request(app)
      .patch(`/api/quotations/${quotation.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' });

    if (acceptRes.status !== 200 || acceptRes.body.status !== 'ACCEPTED') {
      throw new Error(`Step 7 FAILED: Status ${acceptRes.status}, error: ${JSON.stringify(acceptRes.body)}`);
    }
    console.log(`[PASS] Step 7: Quotation status updated to ${acceptRes.body.status}\n`);

    // ----------------------------------------------------
    // STEP 8: Convert quotation to Sales Order
    // ----------------------------------------------------
    console.log('Step 8: Converting ACCEPTED quotation to Sales Order as SALES_USER...');
    const convertRes = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});

    if (convertRes.status !== 201 || !convertRes.body.id) {
      throw new Error(`Step 8 FAILED: Status ${convertRes.status}, error: ${JSON.stringify(convertRes.body)}`);
    }
    salesOrder = convertRes.body;
    console.log(`[PASS] Step 8: Sales Order generated: ${salesOrder.orderNumber}. Status: ${salesOrder.status}\n`);

    // ----------------------------------------------------
    // STEP 9: Confirm that duplicate conversion fails
    // ----------------------------------------------------
    console.log('Step 9: Testing duplicate conversion rejection...');
    const dupConvertRes = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});

    if (dupConvertRes.status !== 409) {
      throw new Error(`Step 9 FAILED: Expected 409 Conflict, got ${dupConvertRes.status}`);
    }
    console.log(`[PASS] Step 9: Duplicate conversion successfully rejected with 409 Conflict: "${dupConvertRes.body.error}"\n`);

    // ----------------------------------------------------
    // STEP 10: Login as ADMIN
    // ----------------------------------------------------
    console.log('Step 10: Logging in as ADMIN (admin@mini.erp)...');
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mini.erp', password: 'Admin@123' });

    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error(`Step 10 FAILED: Status ${adminLoginRes.status}`);
    }
    adminToken = adminLoginRes.body.token;
    console.log(`[PASS] Step 10: ADMIN authenticated successfully. Role: ${adminLoginRes.body.user.role}\n`);

    // Record inventory levels before confirmation
    invBeforeConfirm = await prisma.inventory.findMany({
      where: { productId: { in: [products[0].id, products[1].id] } },
    });

    // ----------------------------------------------------
    // STEP 11: ADMIN Confirms Sales Order
    // ----------------------------------------------------
    console.log(`Step 11: ADMIN confirms Sales Order #${salesOrder.id}...`);
    const confirmRes = await request(app)
      .post(`/api/sales-orders/${salesOrder.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const confirmedOrder = confirmRes.body.order || confirmRes.body;
    if (confirmRes.status !== 200 || confirmedOrder.status !== 'CONFIRMED') {
      throw new Error(`Step 11 FAILED: Status ${confirmRes.status}, error: ${JSON.stringify(confirmRes.body)}`);
    }
    console.log(`[PASS] Step 11: Sales Order successfully CONFIRMED.\n`);

    // ----------------------------------------------------
    // STEP 12 & 13: Verify inventory reservation & available quantity
    // ----------------------------------------------------
    console.log('Step 12 & 13: Verifying inventory reservation and available calculation...');
    const invAfterConfirm = await prisma.inventory.findMany({
      where: { productId: { in: [products[0].id, products[1].id] } },
    });

    for (const prod of products) {
      const b = invBeforeConfirm.find((i) => i.productId === prod.id);
      const a = invAfterConfirm.find((i) => i.productId === prod.id);
      const orderItem = salesOrder.items.find((i) => i.productId === prod.id);

      const expectedReserved = b.reservedQty + orderItem.quantity;
      const expectedPhysical = b.physicalQty;
      const expectedAvailable = expectedPhysical - expectedReserved;

      console.log(`- Product ${prod.productCode}: Physical=${a.physicalQty} (Unchanged: ${expectedPhysical}), Reserved=${a.reservedQty} (Expected: ${expectedReserved}), Available=${a.physicalQty - a.reservedQty} (Expected: ${expectedAvailable})`);

      if (a.physicalQty !== expectedPhysical || a.reservedQty !== expectedReserved) {
        throw new Error(`Step 12/13 FAILED for ${prod.productCode}: reservation quantities did not match.`);
      }
    }
    console.log('[PASS] Step 12 & 13: Inventory reservation and available quantity verified.\n');

    // ----------------------------------------------------
    // STEP 14: Dispatch the Sales Order
    // ----------------------------------------------------
    console.log('Step 14: ADMIN dispatches the Sales Order with vehicle and driver info...');
    const dispatchPayload = {
      vehicleNumber: 'KA-05-NB-9876',
      driverName: 'Vikram Singh',
      notes: 'Dispatched via express logistics',
    };
    const dispatchRes = await request(app)
      .post(`/api/sales-orders/${salesOrder.id}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(dispatchPayload);

    if (dispatchRes.status !== 201 || !dispatchRes.body.dispatch) {
      throw new Error(`Step 14 FAILED: Status ${dispatchRes.status}, error: ${JSON.stringify(dispatchRes.body)}`);
    }
    const dispatch = dispatchRes.body.dispatch;
    console.log(`[PASS] Step 14: Dispatched successfully: ${dispatch.dispatchNumber} (Vehicle: ${dispatch.vehicleNumber})\n`);

    // ----------------------------------------------------
    // STEP 15 & 16: Verify physical quantity and reserved quantity decreased
    // ----------------------------------------------------
    console.log('Step 15 & 16: Verifying physical and reserved stock decrements...');
    const invAfterDispatch = await prisma.inventory.findMany({
      where: { productId: { in: [products[0].id, products[1].id] } },
    });

    for (const prod of products) {
      const b = invBeforeConfirm.find((i) => i.productId === prod.id);
      const a = invAfterDispatch.find((i) => i.productId === prod.id);
      const orderItem = salesOrder.items.find((i) => i.productId === prod.id);

      // On dispatch: physical decreases by qty, reserved decreases by qty (back to initial)
      const expectedPhysical = b.physicalQty - orderItem.quantity;
      const expectedReserved = b.reservedQty; // returned to baseline

      console.log(`- Product ${prod.productCode}: Physical=${a.physicalQty} (Expected: ${expectedPhysical}), Reserved=${a.reservedQty} (Expected: ${expectedReserved})`);

      if (a.physicalQty !== expectedPhysical || a.reservedQty !== expectedReserved) {
        throw new Error(`Step 15/16 FAILED for ${prod.productCode}: stock decrement mismatch.`);
      }
    }
    console.log('[PASS] Step 15 & 16: Physical and reserved quantities decreased correctly without negatives.\n');

    // ----------------------------------------------------
    // STEP 17: Verify Sales Order becomes DISPATCHED
    // ----------------------------------------------------
    console.log('Step 17: Verifying Sales Order status is DISPATCHED...');
    const orderCheck = await prisma.salesOrder.findUnique({ where: { id: salesOrder.id } });
    if (orderCheck.status !== 'DISPATCHED') {
      throw new Error(`Step 17 FAILED: Expected DISPATCHED, got ${orderCheck.status}`);
    }
    console.log(`[PASS] Step 17: Sales Order status is confirmed as '${orderCheck.status}'.\n`);

    // ----------------------------------------------------
    // STEP 18: Verify unauthorized operations fail
    // ----------------------------------------------------
    console.log('Step 18: Verifying unauthorized operations (SALES_USER attempting ADMIN endpoints)...');
    
    // SALES_USER attempting confirm
    const badConfirm = await request(app)
      .post(`/api/sales-orders/${salesOrder.id}/confirm`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    if (badConfirm.status !== 403) {
      throw new Error(`Step 18 FAILED: Expected 403 for SALES_USER confirm, got ${badConfirm.status}`);
    }

    // SALES_USER attempting dispatch
    const badDispatch = await request(app)
      .post(`/api/sales-orders/${salesOrder.id}/dispatch`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    if (badDispatch.status !== 403) {
      throw new Error(`Step 18 FAILED: Expected 403 for SALES_USER dispatch, got ${badDispatch.status}`);
    }

    // Unauthenticated request
    const noAuthRes = await request(app).get('/api/sales-orders');
    if (noAuthRes.status !== 401) {
      throw new Error(`Step 18 FAILED: Expected 401 for unauthenticated request, got ${noAuthRes.status}`);
    }
    console.log('[PASS] Step 18: All RBAC restrictions strictly verified (403 Forbidden for non-admin, 401 for unauthenticated).\n');

    console.log('====================================================');
    console.log('ALL 18 ACCEPTANCE STEPS PASSED SUCCESSFULLY! [18/18]');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\nE2E ACCEPTANCE TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2E();
