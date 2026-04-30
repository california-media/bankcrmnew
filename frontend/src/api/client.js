import axios from 'axios';

/**
 * Axios instance for the Bank CRM API.
 *
 * - Base URL: VITE_API_URL (defaults to http://localhost:5000/api)
 * - Auth: attaches `Authorization: Bearer <token>` from localStorage
 * - 401 handling: clears the stored token (caller decides where to redirect)
 *
 * Endpoint shapes are documented as JSDoc on each backend controller in
 * backend/controllers/. Mirror those shapes when calling from slices/components.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(err);
  }
);

export default api;
