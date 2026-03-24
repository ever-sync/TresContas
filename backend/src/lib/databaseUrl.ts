import type { DatabaseSslMode } from '../config/security';

const SSL_QUERY_PARAMS = ['sslmode', 'ssl', 'uselibpqcompat'] as const;

export const normalizeDatabaseConnectionString = (
    connectionString: string,
    databaseSslMode: DatabaseSslMode
) => {
    const url = new URL(connectionString);

    if (databaseSslMode !== 'strict') {
        for (const param of SSL_QUERY_PARAMS) {
            url.searchParams.delete(param);
        }
    }

    return url.toString();
};
