const prisma = require('../db/prisma');

class SalesOrderService {
  async getAllOrders() {
    return prisma.salesOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        quotation: {
          select: { id: true, quotationNumber: true, status: true },
        },
        items: {
          include: { product: true },
        },
        dispatches: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });
  }

  async getOrderById(id) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        customer: true,
        quotation: true,
        items: {
          include: { product: true },
        },
        dispatches: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    if (!order) {
      const err = new Error('Sales Order not found.');
      err.status = 404;
      throw err;
    }

    return order;
  }

  /**
   * ADMIN ONLY: Confirm Sales Order and atomically reserve stock.
   * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) to prevent concurrent overselling.
   */
  async confirmOrder(id) {
    const orderId = parseInt(id, 10);
    const order = await this.getOrderById(orderId);

    if (order.status !== 'PENDING') {
      const err = new Error(`Cannot confirm Sales Order in '${order.status}' status. Only PENDING orders can be confirmed.`);
      err.status = 400;
      throw err;
    }

    if (!order.items || order.items.length === 0) {
      const err = new Error('Sales Order has no items to reserve.');
      err.status = 400;
      throw err;
    }

    const productIds = order.items.map((i) => i.productId);

    // CRITICAL: Execute transaction with row-level locking (FOR UPDATE)
    return prisma.$transaction(async (tx) => {
      // 1. Lock all inventory rows for the products in this order in consistent ascending order to prevent deadlocks
      const sortedProductIds = [...productIds].sort((a, b) => a - b);
      
      // Execute raw query for row-level lock on inventory
      const lockedInventory = await tx.$queryRaw`
        SELECT id, product_id, physical_quantity, reserved_quantity
        FROM inventory
        WHERE product_id = ANY(${sortedProductIds}::int[])
        ORDER BY product_id ASC
        FOR UPDATE;
      `;

      const inventoryMap = new Map();
      for (const inv of lockedInventory) {
        inventoryMap.set(inv.product_id, {
          id: inv.id,
          physicalQty: inv.physical_quantity,
          reservedQty: inv.reserved_quantity,
          availableQty: inv.physical_quantity - inv.reserved_quantity,
        });
      }

      // 2. Verify availability for every requested item
      for (const item of order.items) {
        const inv = inventoryMap.get(item.productId);
        if (!inv) {
          const err = new Error(`Inventory record not found for product ID ${item.productId}.`);
          err.status = 400;
          throw err;
        }

        const available = inv.physicalQty - inv.reservedQty;
        if (item.quantity > available) {
          const err = new Error(
            `Insufficient inventory for product '${item.product.name}' (${item.product.productCode}). Requested: ${item.quantity}, Available: ${available} (Physical: ${inv.physicalQty}, Reserved: ${inv.reservedQty}).`
          );
          err.status = 400;
          throw err;
        }
      }

      // 3. Atomically update reserved_quantity for all items (physical_quantity remains unchanged)
      for (const item of order.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            reservedQty: {
              increment: item.quantity,
            },
          },
        });
      }

      // 4. Update Sales Order status to CONFIRMED
      const confirmedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
        include: {
          customer: true,
          items: { include: { product: true } },
          dispatches: true,
        },
      });

      return confirmedOrder;
    }, { maxWait: 15000, timeout: 30000 });
  }

  async cancelOrder(id) {
    const orderId = parseInt(id, 10);
    const order = await this.getOrderById(orderId);

    if (order.status === 'DISPATCHED') {
      const err = new Error('Cannot cancel an already DISPATCHED Sales Order.');
      err.status = 400;
      throw err;
    }

    if (order.status === 'CANCELLED') {
      const err = new Error('Sales Order is already CANCELLED.');
      err.status = 400;
      throw err;
    }

    // If order was CONFIRMED, transactionally release the reserved stock
    return prisma.$transaction(async (tx) => {
      if (order.status === 'CONFIRMED') {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: {
              reservedQty: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      return tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
        include: { customer: true, items: { include: { product: true } } },
      });
    }, { maxWait: 15000, timeout: 30000 });
  }
}

module.exports = new SalesOrderService();
