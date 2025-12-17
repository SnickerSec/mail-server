import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Domains from './pages/Domains';
import DomainDetail from './pages/DomainDetail';
import Logs from './pages/Logs';
import Layout from './components/Layout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={() => setIsAuthenticated(true)} />
          )
        }
      />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Layout onLogout={() => setIsAuthenticated(false)} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Domains />} />
        <Route path="domains/:id" element={<DomainDetail />} />
        <Route path="logs" element={<Logs />} />
      </Route>
    </Routes>
  );
}

export default App;
