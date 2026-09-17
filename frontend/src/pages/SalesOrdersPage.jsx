import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SalesOrdersPage() {
  const { user, isAdmin } = useAuth();

  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderData, invData] = await Promise.all([
        api.getSalesOrders(),
        api.getInventory(),
      ]);
      setOrders(orderData);
      setInventory(invData);
    } catch (err) {
      setError(err.message || 'Failed to load sales orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmOrder = async (orderId) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.confirmSalesOrder(orderId);
      setSuccess(res.message || 'Order confirmed and inventory reserved!');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to confirm sales order.');
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order? Any reserved inventory will be released.')) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await api.cancelSalesOrder(orderId);
      setSuccess(res.message || 'Order cancelled successfully.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to cancel sales order.');
    }
  };

  const openDispatchModal = (order) => {
    setActiveOrder(order);
    setVehicleNumber('');
    setDriverName('');
    setDispatchDate(new Date().toISOString().split('T')[0]);
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        vehicleNumber,
        driverName,
        dispatchDate,
      };
      const res = await api.dispatchSalesOrder(activeOrder.id, payload);
      setSuccess(res.message || 'Sales Order dispatched and stock updated!');
      setShowDispatchModal(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to process dispatch.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Sales Orders & Live Inventory</h2>
          <p>Manage order confirmation, stock reservation, and dispatch operations</p>
        </div>
        <div>
          <button className="btn-secondary" onClick={fetchData}>
            🔄 Refresh Stock
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {/* Real-time Inventory Availability Banner */}
      <div className="card stock-card mb-4">
        <div className="stock-header">
          <h3>📊 Real-time Inventory Stock & Derived Availability</h3>
          <span className="formula-badge">Available = Physical − Reserved</span>
        </div>
        <div className="table-responsive">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th className="text-right">Physical Stock</th>
                <th className="text-right">Reserved Stock</th>
                <th className="text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((inv) => (
                <tr key={inv.productId}>
                  <td className="font-mono font-bold">{inv.productCode}</td>
                  <td>{inv.name}</td>
                  <td>{inv.category}</td>
                  <td className="text-right font-mono">{inv.physicalQty} {inv.unit}</td>
                  <td className="text-right font-mono text-warning">
                    {inv.reservedQty} {inv.unit}
                  </td>
                  <td className="text-right font-mono font-bold text-success">
                    {inv.availableQty} {inv.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Orders List */}
      {loading ? (
        <div className="loading-spinner">Loading sales orders...</div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Quotation Ref</th>
                  <th>Order Date</th>
                  <th>Total Amount</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">
                      No Sales Orders found. Convert an ACCEPTED quotation to create an order.
                    </td>
                  </tr>
                ) : (
                  orders.map((so) => (
                    <tr key={so.id}>
                      <td className="font-mono font-bold">{so.orderNumber}</td>
                      <td>
                        <strong>{so.customer?.companyName}</strong>
                        <div className="text-muted text-xs">{so.customer?.city}</div>
                      </td>
                      <td className="font-mono text-sm">{so.quotation?.quotationNumber}</td>
                      <td>{new Date(so.orderDate).toLocaleDateString()}</td>
                      <td className="font-bold">₹{Number(so.totalAmount).toLocaleString()}</td>
                      <td>
                        <ul className="item-badge-list">
                          {so.items?.map((item) => (
                            <li key={item.id} className="badge-item">
                              {item.product?.name} × <strong>{item.quantity}</strong>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <span className={`status-badge status-${so.status.toLowerCase()}`}>
                          {so.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {/* PENDING STATUS */}
                          {so.status === 'PENDING' && (
                            <>
                              {isAdmin ? (
                                <button
                                  className="btn-sm btn-primary"
                                  onClick={() => handleConfirmOrder(so.id)}
                                  title="Confirm order and reserve inventory (ADMIN only)"
                                >
                                  🔒 Confirm & Reserve
                                </button>
                              ) : (
                                <button
                                  className="btn-sm btn-disabled"
                                  disabled
                                  title="Only ADMIN can confirm orders"
                                >
                                  Admin Required
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  className="btn-sm btn-outline-danger"
                                  onClick={() => handleCancelOrder(so.id)}
                                  title="Cancel order"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}

                          {/* CONFIRMED STATUS */}
                          {so.status === 'CONFIRMED' && (
                            <>
                              {isAdmin ? (
                                <button
                                  className="btn-sm btn-success"
                                  onClick={() => openDispatchModal(so)}
                                  title="Process dispatch and reduce stock (ADMIN only)"
                                >
                                  🚚 Dispatch
                                </button>
                              ) : (
                                <span className="text-muted text-xs">Ready for Dispatch</span>
                              )}
                              {isAdmin && (
                                <button
                                  className="btn-sm btn-outline-danger"
                                  onClick={() => handleCancelOrder(so.id)}
                                  title="Cancel order and release reserved stock"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}

                          {/* DISPATCHED STATUS */}
                          {so.status === 'DISPATCHED' && (
                            <div className="dispatch-info">
                              {so.dispatches && so.dispatches.length > 0 && (
                                <div className="text-xs text-muted">
                                  <strong>{so.dispatches[0].dispatchNumber}</strong>
                                  <div>🚛 {so.dispatches[0].vehicleNumber || 'No vehicle #'}</div>
                                  <div>👤 {so.dispatches[0].driverName || 'No driver name'}</div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* CANCELLED STATUS */}
                          {so.status === 'CANCELLED' && (
                            <span className="text-muted text-xs">Cancelled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && activeOrder && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Process Dispatch for Order {activeOrder.orderNumber}</h3>
              <button className="btn-close" onClick={() => setShowDispatchModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleDispatchSubmit}>
              <div className="modal-body">
                <div className="alert-info text-xs mb-3">
                  Confirming dispatch will deduct items from <strong>Physical Quantity</strong> and release from <strong>Reserved Quantity</strong> transactionally.
                </div>

                <div className="form-group">
                  <label>Dispatch Date *</label>
                  <input
                    type="date"
                    required
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH-12-DE-5678"
                  />
                </div>

                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Ramesh Patil"
                  />
                </div>

                <div className="items-summary mt-3">
                  <label className="text-xs font-bold">Items Being Dispatched:</label>
                  <ul className="item-badge-list mt-1">
                    {activeOrder.items?.map((item) => (
                      <li key={item.id} className="badge-item">
                        {item.product?.name}: <strong>{item.quantity}</strong> {item.product?.unit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDispatchModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-success">
                  Confirm Dispatch & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
