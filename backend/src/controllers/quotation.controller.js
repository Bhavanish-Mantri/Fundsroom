const quotationService = require('../services/quotation.service');

class QuotationController {
  async getAll(req, res) {
    try {
      const quotations = await quotationService.getAllQuotations();
      return res.status(200).json(quotations);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const quotation = await quotationService.getQuotationById(req.params.id);
      return res.status(200).json(quotation);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async create(req, res) {
    try {
      const quotation = await quotationService.createQuotation(req.body);
      return res.status(201).json(quotation);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const quotation = await quotationService.updateStatus(req.params.id, status);
      return res.status(200).json(quotation);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async convert(req, res) {
    try {
      const salesOrder = await quotationService.convertToSalesOrder(req.params.id);
      return res.status(201).json(salesOrder);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

module.exports = new QuotationController();
