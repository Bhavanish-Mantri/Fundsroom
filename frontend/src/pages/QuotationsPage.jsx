import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function QuotationsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New Quotation Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [qData, eData, pData] = await Promise.all([
        api.getQuotations(),
        api.getEnquiries(),
        api.getProducts(),
      ]);
      setQuotations(qData);
      setEnquiries(eData);
      setProducts(pData);

      // Check URL search params for enquiryId
      const params = new URLSearchParams(location.search);
      const enqParam = params.get('enquiryId');
      if (enqParam) {
        initModalFromEnquiry(parseInt(enqParam, 10), eData, pData);
      }
    } catch (err) {
      setError(err.message || 'Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [location.search]);

  const initModalFromEnquiry = (enqId, enqList = enquiries, prodList = products) => {
    const targetEnq = enqList.find((e) => e.id === enqId);
    if (targetEnq) {
      setSelectedEnquiryId(targetEnq.id);
      if (targetEnq.items && targetEnq.items.length > 0) {
        const mappedItems = targetEnq.items.map((i) => {
          const matchedProd = prodList.find((p) => p.id === i.productId);
          return {
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: matchedProd ? matchedProd.basePrice : 1000,
            discountPct: 0,
            gstPct: 18,
          };
        });
        setItems(mappedItems);
      } else {
        setItems([{ productId: prodList[0]?.id || '', quantity: 1, unitPrice: prodList[0]?.basePrice || 1000, discountPct: 0, gstPct: 18 }]);
      }
      setShowModal(true);
    }
  };

  const handleEnquirySelect = (enqId) => {
    setSelectedEnquiryId(enqId);
    initModalFromEnquiry(parseInt(enqId, 10));
  };

  const handleAddItem = () => {
    const firstProd = products[0];
    setItems([
      ...items,
      {
        productId: firstProd?.id || '',
        quantity: 1,
        unitPrice: firstProd?.basePrice || 1000,
        discountPct: 0,
        gstPct: 18,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'productId') {
      const prod = products.find((p) => p.id === parseInt(value, 10));
      if (prod) {
        updated[index].unitPrice = prod.basePrice;
      }
    }
    setItems(updated);
  };

  // Live item calculation for preview
  const calculatePreview = (item) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const disc = parseFloat(item.discountPct) || 0;
    const gst = parseFloat(item.gstPct) || 0;

    const base = qty * price;
    const discAmt = (base * disc) / 100;
    const afterDisc = base - discAmt;
    const gstAmt = (afterDisc * gst) / 100;
    const lineAmt = afterDisc + gstAmt;
    return lineAmt;
  };

  const calculateGrandTotalPreview = () => {
    return items.reduce((sum, item) => sum + calculatePreview(item), 0);
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        enquiryId: parseInt(selectedEnquiryId, 10),
        validUntil: validUntil || null,
        items: items.map((i) => ({
          productId: parseInt(i.productId, 10),
          quantity: parseInt(i.quantity, 10),
          unitPrice: parseFloat(i.unitPrice),
          discountPct: parseFloat(i.discountPct || 0),
          gstPct: parseFloat(i.gstPct || 0),
        })),
      };

      const created = await api.createQuotation(payload);
      setSuccess(`Quotation ${created.quotationNumber} created with Grand Total ₹${created.grandTotal}!`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create quotation.');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setError('');
    setSuccess('');
    try {
      await api.updateQuotationStatus(id, newStatus);
      setSuccess(`Quotation marked as ${newStatus}.`);
      fetchData();
    } catch (err) {
      setError(err.message || `Failed to update status to ${newStatus}.`);
    }
  };

  const handleConvertToOrder = async (id) => {
    setError('');
    setSuccess('');
    try {
      const salesOrder = await api.convertQuotation(id);
      setSuccess(`Successfully converted to Sales Order ${salesOrder.orderNumber}!`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to convert quotation.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Sales Quotations</h2>
          <p>Create quotations with item-level discount, GST, and convert to Sales Orders</p>
        </div>
        <div>
          <button
            className="btn-primary"
            onClick={() => {
              if (enquiries.length > 0) {
                initModalFromEnquiry(enquiries[0].id);
              } else {
                setError('Please create an enquiry first.');
              }
            }}
          >
            + New Quotation
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {loading ? (
        <div className="loading-spinner">Loading quotations...</div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quotation #</th>
                  <th>Customer</th>
                  <th>Enquiry Ref</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Sales Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      No quotations found. Click "+ New Quotation" to create one.
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => (
                    <tr key={q.id}>
                      <td className="font-mono font-bold">{q.quotationNumber}</td>
                      <td>
                        <strong>{q.customer?.companyName}</strong>
                        <div className="text-muted text-xs">{q.customer?.city}</div>
                      </td>
                      <td className="font-mono text-sm">{q.enquiry?.enquiryNumber}</td>
                      <td className="font-bold text-primary">₹{Number(q.grandTotal).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-${q.status.toLowerCase()}`}>
                          {q.status}
                        </span>
                      </td>
                      <td>
                        {q.salesOrder ? (
                          <span className="badge-so">
                            📦 {q.salesOrder.orderNumber} ({q.salesOrder.status})
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Not Converted</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {q.status === 'DRAFT' && (
                            <button
                              className="btn-sm btn-outline"
                              onClick={() => handleStatusChange(q.id, 'SENT')}
                              title="Send quotation to customer"
                            >
                              📨 Send
                            </button>
                          )}

                          {q.status === 'SENT' && (
                            <>
                              <button
                                className="btn-sm btn-success"
                                onClick={() => handleStatusChange(q.id, 'ACCEPTED')}
                                title="Accept quotation"
                              >
                                ✓ Accept
                              </button>
                              <button
                                className="btn-sm btn-danger"
                                onClick={() => handleStatusChange(q.id, 'REJECTED')}
                                title="Reject quotation"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}

                          {q.status === 'ACCEPTED' && !q.salesOrder && (
                            <button
                              className="btn-sm btn-primary"
                              onClick={() => handleConvertToOrder(q.id)}
                              title="Convert to confirmed Sales Order"
                            >
                              ⚡ Convert to Order
                            </button>
                          )}

                          {q.salesOrder && (
                            <button
                              className="btn-sm btn-secondary"
                              onClick={() => navigate('/sales-orders')}
                            >
                              View Order
                            </button>
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

      {/* New Quotation Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-xl">
            <div className="modal-header">
              <h3>Create Quotation</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateQuotation}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Select Originating Enquiry *</label>
                    <select
                      value={selectedEnquiryId}
                      onChange={(e) => handleEnquirySelect(e.target.value)}
                      required
                    >
                      {enquiries.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.enquiryNumber} — {e.customer?.companyName} ({e.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>Valid Until</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <h4>Quotation Line Items (Item-level Discount & GST)</h4>
                    <button type="button" className="btn-sm btn-secondary" onClick={handleAddItem}>
                      + Add Item
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Product</th>
                          <th style={{ width: '12%' }}>Quantity</th>
                          <th style={{ width: '18%' }}>Unit Price (₹)</th>
                          <th style={{ width: '14%' }}>Discount (%)</th>
                          <th style={{ width: '12%' }}>GST (%)</th>
                          <th style={{ width: '14%' }}>Line Total (₹)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                required
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    [{p.productCode}] {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.discountPct}
                                onChange={(e) => handleItemChange(idx, 'discountPct', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.gstPct}
                                onChange={(e) => handleItemChange(idx, 'gstPct', e.target.value)}
                              />
                            </td>
                            <td className="font-bold text-right">
                              ₹{calculatePreview(item).toFixed(2)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-danger btn-sm"
                                disabled={items.length === 1}
                                onClick={() => handleRemoveItem(idx)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="total-summary-box">
                    <div className="total-note text-xs text-muted">
                      Formula: <code>(Qty × Price - Discount) + GST</code>.<br />
                      Grand total is authoritatively calculated on the backend.
                    </div>
                    <div className="total-display">
                      <span className="total-label">Estimated Grand Total:</span>
                      <span className="total-value">
                        ₹{calculateGrandTotalPreview().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Generate Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
