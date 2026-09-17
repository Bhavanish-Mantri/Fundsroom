const productService = require('../services/product.service');

class ProductController {
  async getAll(req, res) {
    try {
      const products = await productService.getAllProducts();
      return res.status(200).json(products);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getInventory(req, res) {
    try {
      const inventory = await productService.getInventory();
      return res.status(200).json(inventory);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

module.exports = new ProductController();
