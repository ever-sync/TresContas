import axios, { type AxiosRequestConfig } from 'axios';
import { resolveApiBaseUrl } from './baseUrl';
import { authService } from './authService';
import { handleUnauthorizedStaffSession } from '../lib/authSession';

const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    withCredentials: true,
});

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

const shouldSkipRefresh = (requestUrl?: string) => {
    if (!requestUrl) return false;

    return [
        '/auth/login',
        '/auth/register',
        '/auth/me',
        '/auth/refresh',
        '/auth/logout',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/auth/accept-invite',
        '/auth/client-login',
        '/auth/client-refresh',
        '/auth/client-logout',
    ].some((path) => requestUrl.includes(path));
};

let staffRefreshPromise: Promise<boolean> | null = null;

const refreshStaffSession = async () => {
    if (!staffRefreshPromise) {
        staffRefreshPromise = authService.refreshStaffSession()
            .then(() => true)
            .catch(() => false)
            .finally(() => {
                staffRefreshPromise = null;
            });
    }

    return staffRefreshPromise;
};

api.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        if (!axios.isAxiosError(error)) {
            return Promise.reject(error);
        }

        const originalRequest = error.config as RetryableConfig | undefined;

        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !shouldSkipRefresh(originalRequest.url)
        ) {
            originalRequest._retry = true;
            const refreshed = await refreshStaffSession();

            if (refreshed) {
                return api(originalRequest);
            }

            handleUnauthorizedStaffSession();
        }

        return Promise.reject(error);
    }
);

export default api;
