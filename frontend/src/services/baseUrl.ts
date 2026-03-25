const readViteEnv = (): Record<string, string | undefined> => {
    try {
        return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
    } catch {
        return {};
    }
};

export const resolveApiBaseUrl = () => {
    const rawBaseUrl = readViteEnv().VITE_API_URL || 'http://localhost:3001/api';
    const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

    return normalizedBaseUrl.endsWith('/api')
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/api`;
};
