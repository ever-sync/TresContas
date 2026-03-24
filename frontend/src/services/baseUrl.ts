export const resolveApiBaseUrl = () => {
    const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

    return normalizedBaseUrl.endsWith('/api')
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/api`;
};
