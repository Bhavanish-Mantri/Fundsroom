const prisma = require('../db/prisma');

class ProductService {
  async getAllProducts() {
    return prisma.product.findMany({
      orderBy: { productCode: 'asc' },
      include: {
        inventory: true,
      },
    });
  }

  async getInventory() {
    const products = await prisma.product.findMany({
      orderBy: { productCode: 'asc' },
      include: {
        inventory: true,
      },
    });

    return products.map((p) => {
      const physicalQty = p.inventory ? p.inventory.physicalQty : 0;
      const reservedQty = p.inventory ? p.inventory.reservedQty : 0;
      const availableQty = physicalQty - reservedQty;

      return {
        productId: p.id,
        productCode: p.productCode,
        name: p.name,
        category: p.category,
        unit: p.unit,
        basePrice: p.basePrice,
        physicalQty,
        reservedQty,
        availableQty, // Strictly derived: physical - reserved
      };
    });
  }
}

module.exports = new ProductService();
