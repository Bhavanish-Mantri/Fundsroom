const express = require('express');
const salesOrderController = require('../controllers/salesOrder.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => salesOrderController.getAll(req, res));
router.get('/:id', (req, res) => salesOrderController.getById(req, res));

// ADMIN ONLY endpoints:
router.post('/:id/confirm', requireRole('ADMIN'), (req, res) => salesOrderController.confirm(req, res));
router.patch('/:id/cancel', requireRole('ADMIN'), (req, res) => salesOrderController.cancel(req, res));
router.post('/:id/dispatch', requireRole('ADMIN'), (req, res) => salesOrderController.dispatch(req, res));

module.exports = router;
