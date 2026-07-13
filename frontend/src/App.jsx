import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import useAuthStore from './store/authStore';

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (!initialized) {
    return <div style={{ padding: '2rem' }}>Memuat...</div>;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
