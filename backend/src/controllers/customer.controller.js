const customerService = require('../services/customer.service');

class CustomerController {
  async getAll(req, res) {
    try {
      const customers = await customerService.getAllCustomers();
      return res.status(200).json(customers);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const customer = await customerService.getCustomerById(req.params.id);
      return res.status(200).json(customer);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async create(req, res) {
    try {
      const customer = await customerService.createCustomer(req.body);
      return res.status(201).json(customer);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

module.exports = new CustomerController();
