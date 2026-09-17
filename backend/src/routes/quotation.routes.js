const express = require('express');
const quotationController = require('../controllers/quotation.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => quotationController.getAll(req, res));
router.get('/:id', (req, res) => quotationController.getById(req, res));
router.post('/', requireRole('ADMIN', 'SALES_USER'), (req, res) => quotationController.create(req, res));
router.patch('/:id/status', requireRole('ADMIN', 'SALES_USER'), (req, res) => quotationController.updateStatus(req, res));
router.post('/:id/convert', requireRole('ADMIN', 'SALES_USER'), (req, res) => quotationController.convert(req, res));

module.exports = router;
