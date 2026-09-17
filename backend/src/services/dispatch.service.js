const prisma = require('../db/prisma');

class DispatchService {
  async getAllDispatches() {
    return prisma.dispatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        salesOrder: {
          include: { customer: true },
        },
        items: {
          include: { product: true },
        },
      },
    });
  }

  async getDispatchById(id) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        salesOrder: {
          include: { customer: true, items: { include: { product: true } } },
        },
        items: {
          include: { product: true },
        },
      },
    });

    if (!dispatch) {
      const err = new Error('Dispatch record not found.');
      err.status = 404;
      throw err;
    }

    return dispatch;
  }

  /**
   * ADMIN ONLY: Process dispatch from a confirmed Sales Order.
   * Decreases both physical_quantity and reserved_quantity transactionally.
   */
  async createDispatch(orderId, dispatchData) {
    const id = parseInt(orderId, 10);

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        dispatches: {
          include: { items: true },
        },
      },
    });

    if (!order) {
      const err = new Error('Sales Order not found.');
      err.status = 404;
      throw err;
    }

    // Rule: Cannot dispatch a cancelled order
    if (order.status === 'CANCELLED') {
      const err = new Error('Cannot dispatch a CANCELLED Sales Order.');
      err.status = 400;
      throw err;
    }

    // Rule: Only CONFIRMED orders can be dispatched
    if (order.status !== 'CONFIRMED') {
      const err = new Error(`Only CONFIRMED Sales Orders can be dispatched. Current status is '${order.status}'.`);
      err.status = 400;
      throw err;
    }

    // Rule: Cannot duplicate dispatch
    if (order.dispatches && order.dispatches.length > 0) {
      const err = new Error(`Sales Order '${order.orderNumber}' has already been dispatched.`);
      err.status = 409;
      throw err;
    }

    // Prepare dispatch items: defaults to full order items if items array not provided
    const itemsToDispatch = Array.isArray(dispatchData.items) && dispatchData.items.length > 0
      ? dispatchData.items
      : order.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));

    const sortedProductIds = itemsToDispatch.map((i) => parseInt(i.productId, 10)).sort((a, b) => a - b);

    // CRITICAL: Execute transactional dispatch
    return prisma.$transaction(async (tx) => {
      // 1. Lock inventory rows
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
        });
      }

      // 2. Validate dispatch quantities against reserved stock and order items
      const validatedDispatchItems = [];

      for (const dItem of itemsToDispatch) {
        const productId = parseInt(dItem.productId, 10);
        const quantity = parseInt(dItem.quantity, 10);

        if (!quantity || isNaN(quantity) || quantity <= 0) {
          const err = new Error('Dispatch quantity must be a positive integer (> 0).');
          err.status = 400;
          throw err;
        }

        const orderItem = order.items.find((oi) => oi.productId === productId);
        if (!orderItem) {
          const err = new Error(`Product ID ${productId} is not part of this Sales Order.`);
          err.status = 400;
          throw err;
        }

        if (quantity > orderItem.quantity) {
          const err = new Error(
            `Dispatch quantity (${quantity}) exceeds ordered quantity (${orderItem.quantity}) for product '${orderItem.product.name}'.`
          );
          err.status = 400;
          throw err;
        }

        const inv = inventoryMap.get(productId);
        if (!inv) {
          const err = new Error(`Inventory not found for product ID ${productId}.`);
          err.status = 400;
          throw err;
        }

        // Rule: Cannot dispatch more than reserved quantity
        if (quantity > inv.reservedQty) {
          const err = new Error(
            `Dispatch quantity (${quantity}) exceeds reserved quantity (${inv.reservedQty}) for product '${orderItem.product.name}'.`
          );
          err.status = 400;
          throw err;
        }

        if (quantity > inv.physicalQty) {
          const err = new Error(
            `Dispatch quantity (${quantity}) exceeds physical quantity (${inv.physicalQty}) for product '${orderItem.product.name}'.`
          );
          err.status = 400;
          throw err;
        }

        validatedDispatchItems.push({ productId, quantity });
      }

      // 3. Atomically decrease physical_quantity and reserved_quantity
      for (const item of validatedDispatchItems) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            physicalQty: { decrement: item.quantity },
            reservedQty: { decrement: item.quantity },
          },
        });
      }

      // 4. Generate unique dispatch number
      const count = await tx.dispatch.count();
      const dispatchNumber = dispatchData.dispatchNumber || `DSP-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

      // 5. Create dispatch record
      const dispatchRecord = await tx.dispatch.create({
        data: {
          dispatchNumber,
          salesOrderId: order.id,
          dispatchDate: dispatchData.dispatchDate ? new Date(dispatchData.dispatchDate) : new Date(),
          vehicleNumber: dispatchData.vehicleNumber ? dispatchData.vehicleNumber.trim() : null,
          driverName: dispatchData.driverName ? dispatchData.driverName.trim() : null,
          items: {
            create: validatedDispatchItems,
          },
        },
        include: {
          items: { include: { product: true } },
          salesOrder: { include: { customer: true } },
        },
      });

      // 6. Update order status to DISPATCHED
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: 'DISPATCHED' },
      });

      return dispatchRecord;
    }, { maxWait: 15000, timeout: 30000 });
  }
}

module.exports = new DispatchService();
