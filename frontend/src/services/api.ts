import axios from 'axios';
import { handleUnauthorizedStaffSession, getStaffTokenForRequest } from '../lib/authSession';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const baseURL = normalizedBaseUrl.endsWith('/api')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api`;

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
    const token = getStaffTokenForRequest(config.url);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            handleUnauthorizedStaffSession();
        }

        return Promise.reject(error);
    }
);

export default api;
