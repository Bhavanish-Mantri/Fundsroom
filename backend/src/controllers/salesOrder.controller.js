const salesOrderService = require('../services/salesOrder.service');
const dispatchService = require('../services/dispatch.service');

class SalesOrderController {
  async getAll(req, res) {
    try {
      const orders = await salesOrderService.getAllOrders();
      return res.status(200).json(orders);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const order = await salesOrderService.getOrderById(req.params.id);
      return res.status(200).json(order);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async confirm(req, res) {
    try {
      const confirmed = await salesOrderService.confirmOrder(req.params.id);
      return res.status(200).json({
        message: 'Sales Order confirmed and stock reserved successfully.',
        order: confirmed,
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async cancel(req, res) {
    try {
      const cancelled = await salesOrderService.cancelOrder(req.params.id);
      return res.status(200).json({
        message: 'Sales Order cancelled successfully.',
        order: cancelled,
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async dispatch(req, res) {
    try {
      const dispatchRecord = await dispatchService.createDispatch(req.params.id, req.body);
      return res.status(201).json({
        message: 'Sales Order dispatched and stock updated successfully.',
        dispatch: dispatchRecord,
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

module.exports = new SalesOrderController();
