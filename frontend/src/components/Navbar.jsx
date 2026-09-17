import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-logo">⚙️</span>
          <span className="brand-title">Mini ERP</span>
        </div>

        <nav className="nav-links">
          <NavLink to="/enquiries" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Enquiries
          </NavLink>
          <NavLink to="/quotations" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Quotations
          </NavLink>
          <NavLink to="/sales-orders" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            Sales Orders & Stock
          </NavLink>
        </nav>

        <div className="nav-user">
          <div className="user-badge">
            <span className="user-name">{user?.name}</span>
            <span className={`role-tag ${user?.role === 'ADMIN' ? 'role-admin' : 'role-sales'}`}>
              {user?.role}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Log out">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
