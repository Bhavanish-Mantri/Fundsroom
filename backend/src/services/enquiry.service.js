const prisma = require('../db/prisma');

class EnquiryService {
  async getAllEnquiries() {
    return prisma.enquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async getEnquiryById(id) {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        quotations: true,
      },
    });

    if (!enquiry) {
      const err = new Error('Enquiry not found.');
      err.status = 404;
      throw err;
    }

    return enquiry;
  }

  async createEnquiry(data) {
    const { customerId, enquiryDate, requiredDate, notes, items } = data;

    if (!customerId) {
      const err = new Error('customerId is required.');
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('At least one product item is required in the enquiry.');
      err.status = 400;
      throw err;
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId, 10) },
    });
    if (!customer) {
      const err = new Error('Customer not found.');
      err.status = 404;
      throw err;
    }

    // Validate items
    const seenProducts = new Set();
    const validatedItems = [];

    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);

      if (!productId || isNaN(productId)) {
        const err = new Error('Valid productId is required for each enquiry item.');
        err.status = 400;
        throw err;
      }

      if (!quantity || isNaN(quantity) || quantity <= 0) {
        const err = new Error('Quantity must be a positive integer (> 0).');
        err.status = 400;
        throw err;
      }

      if (seenProducts.has(productId)) {
        const err = new Error(`Duplicate product ID ${productId} in enquiry items.`);
        err.status = 400;
        throw err;
      }
      seenProducts.add(productId);

      // Verify product exists
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        const err = new Error(`Product with ID ${productId} not found.`);
        err.status = 404;
        throw err;
      }

      validatedItems.push({ productId, quantity });
    }

    const count = await prisma.enquiry.count();
    const enquiryNumber = data.enquiryNumber || `ENQ-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

    return prisma.enquiry.create({
      data: {
        enquiryNumber,
        customerId: customer.id,
        enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        notes: notes ? notes.trim() : null,
        status: 'NEW',
        items: {
          create: validatedItems,
        },
      },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async updateStatus(id, newStatus) {
    const validStatuses = ['NEW', 'QUOTED', 'WON', 'LOST'];
    if (!validStatuses.includes(newStatus)) {
      const err = new Error(`Invalid enquiry status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const enquiry = await this.getEnquiryById(id);

    // State machine validation:
    // NEW -> QUOTED -> WON / LOST
    // WON / LOST are terminal states
    if (enquiry.status === 'WON' || enquiry.status === 'LOST') {
      const err = new Error(`Cannot change status of terminal enquiry (${enquiry.status}).`);
      err.status = 400;
      throw err;
    }

    if (enquiry.status === 'NEW' && (newStatus === 'WON' || newStatus === 'LOST')) {
      const err = new Error(`Cannot transition directly from NEW to ${newStatus}. Must be QUOTED first.`);
      err.status = 400;
      throw err;
    }

    return prisma.enquiry.update({
      where: { id: parseInt(id, 10) },
      data: { status: newStatus },
      include: { customer: true, items: { include: { product: true } } },
    });
  }
}

module.exports = new EnquiryService();
