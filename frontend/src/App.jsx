import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import PublicForm from './pages/PublicForm';
import PaymentPage from './pages/PaymentPage';
import './App.css';

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };
    // Intercept standard state pops
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Payment page: /pay/{token}
  if (path.startsWith('/pay/')) {
    const token = path.split('/pay/')[1];
    return <PaymentPage token={token} />;
  }

  // Public form: /form/{slug}
  if (path.startsWith('/form/')) {
    const slug = path.split('/form/')[1];
    return <PublicForm slug={slug} />;
  }

  // Fallback to Admin Dashboard
  return <Dashboard />;
}

export default App;
