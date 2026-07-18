import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import PasswordField from '../../components/common/PasswordField';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Login gagal. Cek email/password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <img src="/logo-pixelso-persegi.png" alt="Pixelso" style={{ height: '48px', width: 'auto' }} />
        </div>
        <h1 style={{ marginBottom: '1.25rem', textAlign: 'center' }}>Pixelso ERP</h1>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group full" style={{ marginBottom: '0.9rem' }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group full" style={{ marginBottom: '1.1rem' }}>
            <label>Password</label>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Masuk...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
