import { useState, FormEvent } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { login, googleAuth } from '../api/auth';
import '../styles/auth.css';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-logo" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = (location.state as any)?.registered;

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await googleAuth(idToken);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      navigate('/portfolio');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Google login failed.';
      setError(typeof msg === 'string' ? msg : 'Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: (tokenResponse) => handleGoogleSuccess(tokenResponse.access_token),
    onError: () => {
      setGoogleLoading(false);
      setError('Google sign-in was cancelled or failed.');
    },
    flow: 'implicit',
    ux_mode: 'popup',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      navigate('/portfolio');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Invalid username or password.';
      setError(typeof msg === 'string' ? msg : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-header">
        <div className="auth-brand">portfolio<span>alert</span></div>
      </div>

      <div className="auth-body">

        <div className="auth-left">
          <div className="auth-left-body">
            <h2>Welcome back!</h2>
            <p>Login to your account using your email and password.</p>
            <p>
              Don't have an account?{' '}
              <Link to="/register">Register for free.</Link>
            </p>
          </div>
          <div className="auth-quote">
            <p>"I started investing at the age of 11. I was late!"</p>
            <strong>Warren Buffett</strong>
          </div>
        </div>

        <div className="auth-right-wrap">
          <div className="auth-card">
            <button
              className="google-btn"
              type="button"
              onClick={() => loginWithGoogle()}
              disabled={googleLoading}
            >
              <GoogleIcon />
              {googleLoading ? 'SIGNING IN...' : 'LOGIN USING GOOGLE'}
            </button>

            <div className="divider">or using email</div>

            {justRegistered && (
              <p className="success-msg">Account created! Please log in.</p>
            )}

            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />

              <label>Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <div className="login-row">
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'LOGGING IN...' : 'LOGIN'}
                </button>
                <Link to="#" className="forgot-link">Lost password?</Link>
              </div>
            </form>

            <p className="bottom-link">
              Don't have an account? <Link to="/register">Register for free.</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
