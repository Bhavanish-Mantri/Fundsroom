const prisma = require('../db/prisma');

class CustomerService {
  async getAllCustomers() {
    return prisma.customer.findMany({
      orderBy: { companyName: 'asc' },
    });
  }

  async getCustomerById(id) {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        enquiries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!customer) {
      const err = new Error('Customer not found.');
      err.status = 404;
      throw err;
    }
    return customer;
  }

  async createCustomer(data) {
    const { companyName, contactPerson, mobile, email, city } = data;

    if (!companyName || !contactPerson || !mobile || !email || !city) {
      const err = new Error('companyName, contactPerson, mobile, email, and city are all required.');
      err.status = 400;
      throw err;
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedCompany = companyName.trim();

    const existing = await prisma.customer.findUnique({
      where: {
        companyName_email: {
          companyName: trimmedCompany,
          email: trimmedEmail,
        },
      },
    });

    if (existing) {
      const err = new Error('A customer with this company name and email already exists.');
      err.status = 409;
      throw err;
    }

    return prisma.customer.create({
      data: {
        companyName: trimmedCompany,
        contactPerson: contactPerson.trim(),
        mobile: mobile.trim(),
        email: trimmedEmail,
        city: city.trim(),
      },
    });
  }
}

module.exports = new CustomerService();
