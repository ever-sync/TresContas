import axios from 'axios';
import { getClientTokenForRequest, handleUnauthorizedClientSession } from '../lib/authSession';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const baseURL = normalizedBaseUrl.endsWith('/api')
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

const clientApi = axios.create({ baseURL });

clientApi.interceptors.request.use((config) => {
  const token = getClientTokenForRequest(config.url);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

clientApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUnauthorizedClientSession();
    }

    return Promise.reject(error);
  }
);

export default clientApi;
