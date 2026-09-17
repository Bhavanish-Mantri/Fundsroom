const express = require('express');
const enquiryController = require('../controllers/enquiry.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => enquiryController.getAll(req, res));
router.get('/:id', (req, res) => enquiryController.getById(req, res));
router.post('/', requireRole('ADMIN', 'SALES_USER'), (req, res) => enquiryController.create(req, res));
router.patch('/:id/status', requireRole('ADMIN', 'SALES_USER'), (req, res) => enquiryController.updateStatus(req, res));

module.exports = router;
