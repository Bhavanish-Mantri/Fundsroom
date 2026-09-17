const express = require('express');
const productController = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Both ADMIN and SALES_USER can view inventory availability
router.get('/', (req, res) => productController.getInventory(req, res));

module.exports = router;
