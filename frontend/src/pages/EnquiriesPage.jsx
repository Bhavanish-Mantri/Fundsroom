import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function EnquiriesPage() {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New Enquiry Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [notes, setNotes] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);

  // Quick Customer Modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    city: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [enqData, custData, prodData] = await Promise.all([
        api.getEnquiries(),
        api.getCustomers(),
        api.getProducts(),
      ]);
      setEnquiries(enqData);
      setCustomers(custData);
      setProducts(prodData);
      if (custData.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custData[0].id);
      }
      if (prodData.length > 0 && items[0].productId === '') {
        setItems([{ productId: prodData[0].id, quantity: 1 }]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = () => {
    const firstProdId = products.length > 0 ? products[0].id : '';
    setItems([...items, { productId: firstProdId, quantity: 1 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        customerId: parseInt(selectedCustomer, 10),
        notes,
        requiredDate: requiredDate || null,
        items: items.map((i) => ({
          productId: parseInt(i.productId, 10),
          quantity: parseInt(i.quantity, 10),
        })),
      };
      const created = await api.createEnquiry(payload);
      setSuccess(`Enquiry ${created.enquiryNumber} created successfully!`);
      setShowModal(false);
      // Reset form
      setNotes('');
      setRequiredDate('');
      setItems([{ productId: products[0]?.id || '', quantity: 1 }]);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create enquiry.');
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const created = await api.createCustomer(newCust);
      setCustomers([...customers, created]);
      setSelectedCustomer(created.id);
      setShowCustModal(false);
      setNewCust({ companyName: '', contactPerson: '', mobile: '', email: '', city: '' });
      setSuccess(`Customer ${created.companyName} added!`);
    } catch (err) {
      setError(err.message || 'Failed to create customer.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Customer Enquiries</h2>
          <p>Create and manage multi-product sales enquiries</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowCustModal(true)}>
            + New Customer
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + New Enquiry
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {loading ? (
        <div className="loading-spinner">Loading enquiries...</div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enquiry #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Products Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">
                      No enquiries found. Click "+ New Enquiry" to create one.
                    </td>
                  </tr>
                ) : (
                  enquiries.map((enq) => (
                    <tr key={enq.id}>
                      <td className="font-mono font-bold">{enq.enquiryNumber}</td>
                      <td>
                        <strong>{enq.customer?.companyName}</strong>
                        <div className="text-muted text-xs">
                          {enq.customer?.contactPerson} ({enq.customer?.city})
                        </div>
                      </td>
                      <td>{new Date(enq.enquiryDate).toLocaleDateString()}</td>
                      <td>
                        <ul className="item-badge-list">
                          {enq.items?.map((item) => (
                            <li key={item.id} className="badge-item">
                              {item.product?.productCode} - {item.product?.name} ×{' '}
                              <strong>{item.quantity}</strong> {item.product?.unit}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <span className={`status-badge status-${enq.status.toLowerCase()}`}>
                          {enq.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-sm btn-outline"
                          onClick={() => navigate(`/quotations?enquiryId=${enq.id}`)}
                          title="Generate quotation from this enquiry"
                        >
                          📄 Create Quote
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Enquiry Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Create Multi-Product Enquiry</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateEnquiry}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Select Customer *</label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      required
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} — {c.city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>Required Date (Optional)</label>
                    <input
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes / Requirements</label>
                  <textarea
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Customer specific notes or delivery preferences..."
                  />
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <h4>Products Requested *</h4>
                    <button type="button" className="btn-sm btn-secondary" onClick={handleAddItem}>
                      + Add Product
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <div className="flex-2">
                        <label className="text-xs">Product</label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          required
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.productCode}] {p.name} ({p.unit}) - ₹{p.basePrice}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="text-xs">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        />
                      </div>

                      <div className="item-delete">
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          disabled={items.length === 1}
                          onClick={() => handleRemoveItem(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showCustModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add New Customer</h3>
              <button className="btn-close" onClick={() => setShowCustModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Company Name *</label>
                  <input
                    required
                    value={newCust.companyName}
                    onChange={(e) => setNewCust({ ...newCust, companyName: e.target.value })}
                    placeholder="e.g. Zenith Engineering Pvt Ltd"
                  />
                </div>
                <div className="form-group">
                  <label>Contact Person *</label>
                  <input
                    required
                    value={newCust.contactPerson}
                    onChange={(e) => setNewCust({ ...newCust, contactPerson: e.target.value })}
                    placeholder="e.g. Anil Kumar"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Mobile Number *</label>
                    <input
                      required
                      value={newCust.mobile}
                      onChange={(e) => setNewCust({ ...newCust, mobile: e.target.value })}
                      placeholder="+91-9876543210"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>City *</label>
                    <input
                      required
                      value={newCust.city}
                      onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    placeholder="contact@zenitheng.com"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
