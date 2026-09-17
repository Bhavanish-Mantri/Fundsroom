require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const quotationService = require('../src/services/quotation.service');

jest.setTimeout(120000);

let adminToken;
let salesToken;
let testCustomer;
let testProducts;

beforeAll(async () => {
  // 1. Obtain Admin Token
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@mini.erp', password: 'Admin@123' });
  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.token;

  // 2. Obtain Sales User Token
  const salesLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sales@mini.erp', password: 'Sales@123' });
  expect(salesLogin.status).toBe(200);
  salesToken = salesLogin.body.token;

  // 3. Load baseline customer and products
  testCustomer = await prisma.customer.findFirst();
  testProducts = await prisma.product.findMany({ take: 3 });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
}, 30000);

describe('Mini ERP Assessment - Mandatory Verification Tests', () => {
  // --------------------------------------------------------------------------
  // Test 1: Quotation total calculation (Financial Calculation Logic)
  // --------------------------------------------------------------------------
  test('1. Quotation item calculations: correctly applies discount, GST, and sums grand_total', () => {
    // Example: Qty 10 @ 1000, 10% discount, 18% GST
    // Base = 10,000
    // Discount = 1,000
    // After Discount = 9,000
    // GST = 1,620
    // Line Amount = 10,620
    const calc1 = quotationService.calculateItemFinancials({
      quantity: 10,
      unitPrice: 1000,
      discountPct: 10,
      gstPct: 18,
    });
    expect(calc1.lineAmount).toBe(10620.00);

    // Example 2: Qty 5 @ 4200, 5% discount, 18% GST
    // Base = 21,000
    // Discount = 1,050
    // After Discount = 19,950
    // GST = 3,591
    // Line Amount = 23,541
    const calc2 = quotationService.calculateItemFinancials({
      quantity: 5,
      unitPrice: 4200,
      discountPct: 5,
      gstPct: 18,
    });
    expect(calc2.lineAmount).toBe(23541.00);
  });

  // --------------------------------------------------------------------------
  // Test 2: Unauthenticated request is rejected
  // --------------------------------------------------------------------------
  test('2. Unauthenticated request to protected endpoints is rejected with 401', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/i);
  });

  // --------------------------------------------------------------------------
  // Test 3: SALES_USER cannot perform ADMIN-only operation
  // --------------------------------------------------------------------------
  test('3. SALES_USER cannot perform ADMIN-only operations (confirm/dispatch) -> 403 Forbidden', async () => {
    const confirmRes = await request(app)
      .post('/api/sales-orders/9999/confirm')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(confirmRes.status).toBe(403);
    expect(confirmRes.body.error).toMatch(/Forbidden/i);

    const dispatchRes = await request(app)
      .post('/api/sales-orders/9999/dispatch')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(dispatchRes.status).toBe(403);
    expect(dispatchRes.body.error).toMatch(/Forbidden/i);
  });

  // --------------------------------------------------------------------------
  // Test 4: DRAFT quotation cannot create Sales Order
  // --------------------------------------------------------------------------
  test('4. DRAFT quotation cannot be converted to a Sales Order -> 400 Bad Request', async () => {
    // Create enquiry
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[0].id, quantity: 2 }],
      });
    expect(enqRes.status).toBe(201);

    // Create DRAFT quotation
    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[0].id, quantity: 2, unitPrice: 4200, discountPct: 5, gstPct: 18 }],
      });
    expect(quotRes.status).toBe(201);
    expect(quotRes.body.status).toBe('DRAFT');

    // Attempt conversion of DRAFT quotation
    const convertRes = await request(app)
      .post(`/api/quotations/${quotRes.body.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(convertRes.status).toBe(400);
    expect(convertRes.body.error).toMatch(/Only ACCEPTED quotations/i);
  });

  // --------------------------------------------------------------------------
  // Test 5: REJECTED quotation cannot create Sales Order
  // --------------------------------------------------------------------------
  test('5. REJECTED quotation cannot be converted to a Sales Order -> 400 Bad Request', async () => {
    // Create enquiry
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[0].id, quantity: 1 }],
      });
    expect(enqRes.status).toBe(201);

    // Create quotation
    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[0].id, quantity: 1, unitPrice: 4200 }],
      });
    expect(quotRes.status).toBe(201);

    // DRAFT -> SENT -> REJECTED
    await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    const rejectRes = await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'REJECTED' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('REJECTED');

    // Attempt conversion
    const convertRes = await request(app)
      .post(`/api/quotations/${quotRes.body.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(convertRes.status).toBe(400);
    expect(convertRes.body.error).toMatch(/Only ACCEPTED quotations/i);
  });

  // --------------------------------------------------------------------------
  // Test 6: Same quotation cannot create duplicate Sales Orders
  // --------------------------------------------------------------------------
  test('6. Accepted quotation converts once; duplicate conversion returns 409 Conflict', async () => {
    // Create enquiry
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[0].id, quantity: 2 }],
      });

    // Create quotation
    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[0].id, quantity: 2, unitPrice: 4200, discountPct: 10, gstPct: 18 }],
      });

    // DRAFT -> SENT -> ACCEPTED
    await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' });

    // First conversion -> 201 Created
    const convert1 = await request(app)
      .post(`/api/quotations/${quotRes.body.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(convert1.status).toBe(201);
    expect(convert1.body.status).toBe('PENDING');
    expect(convert1.body.quotationId).toBe(quotRes.body.id);

    // Second conversion attempt -> 409 Conflict
    const convert2 = await request(app)
      .post(`/api/quotations/${quotRes.body.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(convert2.status).toBe(409);
    expect(convert2.body.error).toMatch(/already exists/i);
  });

  // --------------------------------------------------------------------------
  // Test 7: Cannot reserve more than available inventory
  // --------------------------------------------------------------------------
  test('7. Order confirmation rejected if requested stock > available stock', async () => {
    // Create an order with huge quantity exceeding physical stock
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[0].id, quantity: 99999 }],
      });

    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[0].id, quantity: 99999, unitPrice: 4200 }],
      });

    await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    await request(app)
      .patch(`/api/quotations/${quotRes.body.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' });

    const convertRes = await request(app)
      .post(`/api/quotations/${quotRes.body.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({});
    expect(convertRes.status).toBe(201);
    const orderId = convertRes.body.id;

    // ADMIN attempts to confirm -> must fail with 400
    const confirmRes = await request(app)
      .post(`/api/sales-orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.error).toMatch(/Insufficient inventory/i);

    // Order status should remain PENDING
    const orderCheck = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    expect(orderCheck.status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // Test 8: Successful reservation & Dispatch rules
  // --------------------------------------------------------------------------
  test('8. End-to-end confirmation, stock reservation, and dispatch with stock decrement', async () => {
    // 1. Check stock before
    const invBefore = await prisma.inventory.findUnique({ where: { productId: testProducts[1].id } });
    const initialPhysical = invBefore.physicalQty;
    const initialReserved = invBefore.reservedQty;
    const qtyToOrder = 5;

    // 2. Create and accept quotation for 5 items
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[1].id, quantity: qtyToOrder }],
      });

    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[1].id, quantity: qtyToOrder, unitPrice: 18500 }],
      });

    await request(app).patch(`/api/quotations/${quotRes.body.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${quotRes.body.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });

    const convertRes = await request(app).post(`/api/quotations/${quotRes.body.id}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});
    const orderId = convertRes.body.id;

    // 3. ADMIN Confirms Order
    const confirmRes = await request(app)
      .post(`/api/sales-orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(confirmRes.status).toBe(200);

    // Verify reservation: reservedQty increased by 5, physicalQty unchanged
    const invAfterConfirm = await prisma.inventory.findUnique({ where: { productId: testProducts[1].id } });
    expect(invAfterConfirm.physicalQty).toBe(initialPhysical);
    expect(invAfterConfirm.reservedQty).toBe(initialReserved + qtyToOrder);

    // 4. Over-dispatch rejection test: attempting to dispatch 10 when 5 was ordered
    const overDispatch = await request(app)
      .post(`/api/sales-orders/${orderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProducts[1].id, quantity: 10 }],
      });
    expect(overDispatch.status).toBe(400);
    expect(overDispatch.body.error).toMatch(/exceeds/i);

    // 5. Valid Dispatch: 5 items
    const validDispatch = await request(app)
      .post(`/api/sales-orders/${orderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleNumber: 'MH-12-AB-1234',
        driverName: 'Suresh Kumar',
      });
    expect(validDispatch.status).toBe(201);
    expect(validDispatch.body.dispatch.items[0].quantity).toBe(qtyToOrder);

    // 6. Verify stock after dispatch: physicalQty and reservedQty both decreased by 5
    const invAfterDispatch = await prisma.inventory.findUnique({ where: { productId: testProducts[1].id } });
    expect(invAfterDispatch.physicalQty).toBe(initialPhysical - qtyToOrder);
    expect(invAfterDispatch.reservedQty).toBe(initialReserved); // Decreased back by 5

    // 7. Verify order status is DISPATCHED
    const orderAfterDispatch = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    expect(orderAfterDispatch.status).toBe('DISPATCHED');

    // 8. Duplicate dispatch rejection
    const dupDispatch = await request(app)
      .post(`/api/sales-orders/${orderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(dupDispatch.status).toBe(400); // Already dispatched
  });

  // --------------------------------------------------------------------------
  // Test 9: Cancelled order cannot be dispatched
  // --------------------------------------------------------------------------
  test('9. Cancelled order cannot be dispatched', async () => {
    // Create enquiry and quotation
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        items: [{ productId: testProducts[2].id, quantity: 1 }],
      });

    const quotRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqRes.body.id,
        items: [{ productId: testProducts[2].id, quantity: 1, unitPrice: 9600 }],
      });

    await request(app).patch(`/api/quotations/${quotRes.body.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${quotRes.body.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });
    const convertRes = await request(app).post(`/api/quotations/${quotRes.body.id}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});
    const orderId = convertRes.body.id;

    // Cancel the order
    const cancelRes = await request(app)
      .patch(`/api/sales-orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(cancelRes.status).toBe(200);

    // Attempt dispatch -> must fail
    const dispatchRes = await request(app)
      .post(`/api/sales-orders/${orderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.error).toMatch(/CANCELLED/i);
  });
});
