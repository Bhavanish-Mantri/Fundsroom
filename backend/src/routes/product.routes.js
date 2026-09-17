const express = require('express');
const productController = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => productController.getAll(req, res));

module.exports = router;
