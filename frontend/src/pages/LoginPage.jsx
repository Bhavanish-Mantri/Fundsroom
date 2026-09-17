import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/enquiries');
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail, quickPass) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">⚙️</div>
          <h2>Mini ERP Login</h2>
          <p>Industrial Order & Inventory Management System</p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@mini.erp"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary btn-block">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="quick-login-section">
          <p className="quick-title">Quick Test Credentials:</p>
          <div className="quick-buttons">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => handleQuickLogin('admin@mini.erp', 'Admin@123')}
            >
              👑 Admin (Full Access)
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => handleQuickLogin('sales@mini.erp', 'Sales@123')}
            >
              💼 Sales User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
