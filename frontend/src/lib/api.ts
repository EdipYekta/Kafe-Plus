import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const auth = JSON.parse(localStorage.getItem('kafeplus-auth') || '{}');
      if (auth?.state?.token) config.headers.Authorization = `Bearer ${auth.state.token}`;
    } catch {}
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('kafeplus-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
