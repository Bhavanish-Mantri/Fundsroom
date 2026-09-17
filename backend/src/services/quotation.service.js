const prisma = require('../db/prisma');

class QuotationService {
  calculateItemFinancials(item) {
    const quantity = parseInt(item.quantity, 10);
    const unitPrice = parseFloat(item.unitPrice);
    const discountPct = parseFloat(item.discountPct !== undefined ? item.discountPct : 0);
    const gstPct = parseFloat(item.gstPct !== undefined ? item.gstPct : 18); // Default 18% GST if omitted

    if (isNaN(quantity) || quantity <= 0) {
      const err = new Error('Item quantity must be a positive integer (> 0).');
      err.status = 400;
      throw err;
    }

    if (isNaN(unitPrice) || unitPrice < 0) {
      const err = new Error('Item unitPrice must be a non-negative number (>= 0).');
      err.status = 400;
      throw err;
    }

    if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      const err = new Error('Item discountPct must be between 0 and 100.');
      err.status = 400;
      throw err;
    }

    if (isNaN(gstPct) || gstPct < 0) {
      const err = new Error('Item gstPct must be a non-negative number (>= 0).');
      err.status = 400;
      throw err;
    }

    // Official Calculation:
    // base_amount = quantity * unit_price
    // discount_amount = base_amount * discount_pct / 100
    // after_discount = base_amount - discount_amount
    // gst_amount = after_discount * gst_pct / 100
    // line_amount = after_discount + gst_amount
    const baseAmount = quantity * unitPrice;
    const discountAmount = (baseAmount * discountPct) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = (afterDiscount * gstPct) / 100;
    const lineAmount = parseFloat((afterDiscount + gstAmount).toFixed(2));

    return {
      quantity,
      unitPrice,
      discountPct,
      gstPct,
      lineAmount,
    };
  }

  async getAllQuotations() {
    return prisma.quotation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        enquiry: true,
        salesOrder: {
          select: { id: true, orderNumber: true, status: true },
        },
        items: {
          include: { product: true },
        },
      },
    });
  }

  async getQuotationById(id) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        customer: true,
        enquiry: true,
        salesOrder: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!quotation) {
      const err = new Error('Quotation not found.');
      err.status = 404;
      throw err;
    }

    return quotation;
  }

  async createQuotation(data) {
    const { enquiryId, customerId, validUntil, items } = data;

    if (!enquiryId) {
      const err = new Error('enquiryId is required.');
      err.status = 400;
      throw err;
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: parseInt(enquiryId, 10) },
      include: { customer: true },
    });

    if (!enquiry) {
      const err = new Error('Enquiry not found.');
      err.status = 404;
      throw err;
    }

    const resolvedCustomerId = customerId ? parseInt(customerId, 10) : enquiry.customerId;

    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('At least one quotation item is required.');
      err.status = 400;
      throw err;
    }

    // Validate and calculate every line item strictly on the backend
    const validatedItems = [];
    let calculatedGrandTotal = 0;
    const seenProducts = new Set();

    for (const rawItem of items) {
      const productId = parseInt(rawItem.productId, 10);
      if (!productId || isNaN(productId)) {
        const err = new Error('Valid productId is required for each quotation item.');
        err.status = 400;
        throw err;
      }

      if (seenProducts.has(productId)) {
        const err = new Error(`Duplicate product ID ${productId} in quotation items.`);
        err.status = 400;
        throw err;
      }
      seenProducts.add(productId);

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        const err = new Error(`Product with ID ${productId} not found.`);
        err.status = 404;
        throw err;
      }

      const financials = this.calculateItemFinancials(rawItem);
      calculatedGrandTotal += financials.lineAmount;

      validatedItems.push({
        productId,
        quantity: financials.quantity,
        unitPrice: financials.unitPrice,
        discountPct: financials.discountPct,
        gstPct: financials.gstPct,
        lineAmount: financials.lineAmount,
      });
    }

    calculatedGrandTotal = parseFloat(calculatedGrandTotal.toFixed(2));

    const count = await prisma.quotation.count();
    const quotationNumber = data.quotationNumber || `QT-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
    const expiryDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

    // Transactionally create quotation and update enquiry status to QUOTED if currently NEW
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          enquiryId: enquiry.id,
          customerId: resolvedCustomerId,
          validUntil: expiryDate,
          status: 'DRAFT',
          grandTotal: calculatedGrandTotal,
          items: {
            create: validatedItems,
          },
        },
        include: {
          customer: true,
          enquiry: true,
          items: {
            include: { product: true },
          },
        },
      });

      if (enquiry.status === 'NEW') {
        await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { status: 'QUOTED' },
        });
      }

      return quotation;
    }, { maxWait: 15000, timeout: 30000 });
  }

  async updateStatus(id, newStatus) {
    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
    if (!validStatuses.includes(newStatus)) {
      const err = new Error(`Invalid quotation status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const quotation = await this.getQuotationById(id);

    // State machine: DRAFT -> SENT -> ACCEPTED / REJECTED
    // ACCEPTED / REJECTED are terminal
    if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
      const err = new Error(`Cannot change status of finalized quotation (${quotation.status}).`);
      err.status = 400;
      throw err;
    }

    if (quotation.status === 'DRAFT' && (newStatus === 'ACCEPTED' || newStatus === 'REJECTED')) {
      const err = new Error(`Quotation must be in SENT status before it can be ACCEPTED or REJECTED.`);
      err.status = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id: parseInt(id, 10) },
        data: { status: newStatus },
        include: {
          customer: true,
          enquiry: true,
          items: { include: { product: true } },
          salesOrder: true,
        },
      });

      // Update Enquiry status to WON if ACCEPTED
      if (newStatus === 'ACCEPTED' && quotation.enquiryId) {
        await tx.enquiry.update({
          where: { id: quotation.enquiryId },
          data: { status: 'WON' },
        });
      }

      return updated;
    }, { maxWait: 15000, timeout: 30000 });
  }

  async convertToSalesOrder(id) {
    const quotation = await this.getQuotationById(id);

    // 1. Must be ACCEPTED
    if (quotation.status !== 'ACCEPTED') {
      const err = new Error(`Only ACCEPTED quotations can be converted to a Sales Order. Current status is '${quotation.status}'.`);
      err.status = 400;
      throw err;
    }

    // 2. Prevent duplicate conversion
    if (quotation.salesOrder) {
      const err = new Error(`Sales Order '${quotation.salesOrder.orderNumber}' already exists for this quotation.`);
      err.status = 409;
      throw err;
    }

    // 3. Transactional conversion to Sales Order
    return prisma.$transaction(async (tx) => {
      // Double check within transaction
      const existingSo = await tx.salesOrder.findUnique({
        where: { quotationId: quotation.id },
      });
      if (existingSo) {
        const err = new Error(`Sales Order '${existingSo.orderNumber}' already exists for this quotation.`);
        err.status = 409;
        throw err;
      }

      const count = await tx.salesOrder.count();
      const orderNumber = `SO-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

      // Map quotation items to sales order items
      const orderItems = quotation.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          orderDate: new Date(),
          totalAmount: quotation.grandTotal,
          status: 'PENDING',
          items: {
            create: orderItems,
          },
        },
        include: {
          customer: true,
          quotation: true,
          items: {
            include: { product: true },
          },
        },
      });

      return salesOrder;
    }, { maxWait: 15000, timeout: 30000 });
  }
}

module.exports = new QuotationService();
