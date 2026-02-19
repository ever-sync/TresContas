import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const baseURL = normalizedBaseUrl.endsWith('/api')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api`;

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
