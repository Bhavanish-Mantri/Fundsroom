const enquiryService = require('../services/enquiry.service');

class EnquiryController {
  async getAll(req, res) {
    try {
      const enquiries = await enquiryService.getAllEnquiries();
      return res.status(200).json(enquiries);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const enquiry = await enquiryService.getEnquiryById(req.params.id);
      return res.status(200).json(enquiry);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async create(req, res) {
    try {
      const enquiry = await enquiryService.createEnquiry(req.body);
      return res.status(201).json(enquiry);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const enquiry = await enquiryService.updateStatus(req.params.id, status);
      return res.status(200).json(enquiry);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

module.exports = new EnquiryController();
