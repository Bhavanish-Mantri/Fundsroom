const express = require('express');
const customerController = require('../controllers/customer.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => customerController.getAll(req, res));
router.get('/:id', (req, res) => customerController.getById(req, res));
router.post('/', requireRole('ADMIN', 'SALES_USER'), (req, res) => customerController.create(req, res));

module.exports = router;
