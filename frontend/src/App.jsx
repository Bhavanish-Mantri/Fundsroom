import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import EnquiriesPage from './pages/EnquiriesPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import './index.css';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading application...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/enquiries"
            element={
              <ProtectedLayout>
                <EnquiriesPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/quotations"
            element={
              <ProtectedLayout>
                <QuotationsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/sales-orders"
            element={
              <ProtectedLayout>
                <SalesOrdersPage />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/enquiries" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
