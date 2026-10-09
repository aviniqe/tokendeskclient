import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getToken, me, setToken, setUnauthorizedHandler } from './services/api';
import Shell from './components/Shell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import PayoutsPage from './pages/PayoutsPage';
import WalletPage from './pages/WalletPage';
import ApiPage from './pages/ApiPage';
import { ShellSkeleton } from './components/Skeleton';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!getToken()) {
      setReady(true);
      return;
    }
    me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <ShellSkeleton />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onSuccess={setUser} />}
      />
      <Route
        path="/"
        element={user ? (
          <Shell
            account={user}
            onSignOut={() => {
              setToken('');
              setUser(null);
            }}
          />
        ) : <Navigate to="/login" replace />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="api" element={<ApiPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
