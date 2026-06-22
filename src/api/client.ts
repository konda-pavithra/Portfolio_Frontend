import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
});

// attach JWT to every request if we have one
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// if backend returns 401 kick the user out — but not on auth endpoints themselves
// (a failed Google/password login should show an error message, not redirect)
const AUTH_ENDPOINTS = ['/api/users/login', '/api/users/register', '/api/users/google'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => url.includes(p));
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
