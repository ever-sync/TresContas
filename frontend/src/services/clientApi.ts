import axios from 'axios';
import { useClientAuthStore } from '../stores/useClientAuthStore';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const baseURL = normalizedBaseUrl.endsWith('/api')
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

const clientApi = axios.create({ baseURL });

clientApi.interceptors.request.use((config) => {
  const token = useClientAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default clientApi;
