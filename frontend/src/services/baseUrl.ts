const readViteEnv = (): Record<string, string | undefined> => {
    try {
        return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
    } catch {
        return {};
    }
};

export const resolveApiBaseUrl = () => {
    const configured = readViteEnv().VITE_API_URL;

    if (configured) {
        const normalized = configured.replace(/\/+$/, '');
        return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    }

    // Default: relative /api — works with Vite proxy (dev) and Vercel rewrite (prod)
    return '/api';
};
