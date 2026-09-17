import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Mini ERP</h1>
      <p>Frontend scaffold initialized for Phase 1.</p>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
