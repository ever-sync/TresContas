import axios, { type AxiosRequestConfig } from 'axios';
import { resolveApiBaseUrl } from './baseUrl';
import { authService } from './authService';
import { handleUnauthorizedClientSession } from '../lib/authSession';

const clientApi = axios.create({
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

let clientRefreshPromise: Promise<boolean> | null = null;

const refreshClientSession = async () => {
    if (!clientRefreshPromise) {
        clientRefreshPromise = authService.refreshClientSession()
            .then(() => true)
            .catch(() => false)
            .finally(() => {
                clientRefreshPromise = null;
            });
    }

    return clientRefreshPromise;
};

clientApi.interceptors.response.use(
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
            const refreshed = await refreshClientSession();

            if (refreshed) {
                return clientApi(originalRequest);
            }

            handleUnauthorizedClientSession();
        }

        return Promise.reject(error);
    }
);

export default clientApi;
