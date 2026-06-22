import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { register, googleAuth } from '../api/auth';
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

// same password rules the backend enforces
function validatePassword(pwd: string): string {
  if (pwd.length < 8)               return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pwd))           return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(pwd))           return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(pwd))           return 'Password must include at least one digit.';
  if (!/[@#$%^*\-_]/.test(pwd))     return 'Password must include a special character: @ # $ % ^ * - _';
  return '';
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', reEmail: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleSuccess = async (accessToken: string) => {
    setGoogleLoading(true);
    setServerError('');
    try {
      const res = await googleAuth(accessToken);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      navigate('/portfolio');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Google sign-up failed.';
      setServerError(typeof msg === 'string' ? msg : 'Google sign-up failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const registerWithGoogle = useGoogleLogin({
    onSuccess: (tokenResponse) => handleGoogleSuccess(tokenResponse.access_token),
    onError: () => {
      setGoogleLoading(false);
      setServerError('Google sign-in was cancelled or failed.');
    },
    flow: 'implicit',
    ux_mode: 'popup',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };

    // derive username from email prefix so backend always gets one
    if (name === 'email') updated.username = value.split('@')[0];

    setForm(updated);
    setServerError('');

    // clear the field error as the user types
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!form.email) {
      errors.email = 'Email is required.';
    } else if (!emailRegex.test(form.email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!form.reEmail) {
      errors.reEmail = 'Please confirm your email.';
    } else if (form.email !== form.reEmail) {
      errors.reEmail = 'Emails do not match.';
    }

    const pwdError = validatePassword(form.password);
    if (pwdError) errors.password = pwdError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password });
      navigate('/login', { state: { registered: true } });
    } catch (err: any) {
      // backend sends { message: "..." } inside ErrorResponse
      const msg = err.response?.data?.message || err.response?.data || 'Registration failed. Please try again.';
      setServerError(typeof msg === 'string' ? msg : 'Registration failed.');
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
            <h2>Get a free account</h2>
            <p>Over 50 lakh investors use this for finding and tracking stock ideas.</p>
            <p>
              Already registered?{' '}
              <Link to="/login">Login here.</Link>
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
              onClick={() => registerWithGoogle()}
              disabled={googleLoading}
            >
              <GoogleIcon />
              {googleLoading ? 'SIGNING IN...' : 'REGISTER USING GOOGLE'}
            </button>

            <div className="divider">or using email</div>

            {serverError && <p className="error-msg">{serverError}</p>}

            <form onSubmit={handleSubmit} noValidate>

              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={fieldErrors.email ? 'input-error' : ''}
              />
              {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}

              <label>Re-enter Email</label>
              <input
                type="email"
                name="reEmail"
                value={form.reEmail}
                onChange={handleChange}
                placeholder="Confirm your email"
                className={fieldErrors.reEmail ? 'input-error' : ''}
              />
              {fieldErrors.reEmail && <p className="field-error">{fieldErrors.reEmail}</p>}
              {!fieldErrors.reEmail && <p className="hint">We promise we won't spam</p>}

              <label>Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 8 chars, A-Z, a-z, 0-9, special"
                  className={fieldErrors.password ? 'input-error' : ''}
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
              {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
              {!fieldErrors.password && (
                <p className="hint">
                  By registering you agree to the Terms of Use and have read the Privacy Policy.
                </p>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <p className="bottom-link">
              Already have an account? <Link to="/login">Login here.</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
