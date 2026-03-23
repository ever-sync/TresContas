import type { ConnectionOptions } from 'tls';

export type DatabaseSslMode = 'strict' | 'insecure' | 'disable';

const LOCAL_DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const VALID_DATABASE_SSL_MODES: DatabaseSslMode[] = ['strict', 'insecure', 'disable'];
const DEFAULT_JWT_EXPIRES_IN = '12h';

const toBoolean = (value: string | undefined) => value === 'true';

const normalizeDatabaseSslMode = (value: string | undefined): DatabaseSslMode | null => {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    if (VALID_DATABASE_SSL_MODES.includes(normalized as DatabaseSslMode)) {
        return normalized as DatabaseSslMode;
    }

    throw new Error(`Invalid DATABASE_SSL_MODE "${value}". Use one of: ${VALID_DATABASE_SSL_MODES.join(', ')}.`);
};

const decodeCaCertificate = (value: string | undefined) => {
    if (!value) return undefined;
    return Buffer.from(value, 'base64').toString('utf-8');
};

const parseAllowedOrigins = (value: string | undefined) =>
    Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean)
        )
    );

const resolveLegacyDatabaseSslMode = (env: NodeJS.ProcessEnv): DatabaseSslMode | null => {
    if (toBoolean(env.DATABASE_SSL_STRICT)) return 'strict';
    if (toBoolean(env.DATABASE_SSL_INSECURE)) return 'insecure';

    const explicitRejectUnauthorized = env.PG_SSL_REJECT_UNAUTHORIZED;
    const urlRequestsSsl = /(?:\?|&)(sslmode|ssl)=/i.test(String(env.DATABASE_URL || ''));

    if (explicitRejectUnauthorized === 'true') return 'strict';
    if (explicitRejectUnauthorized === 'false') return 'insecure';
    if (urlRequestsSsl) return 'strict';

    return null;
};

export interface SecurityConfig {
    isProduction: boolean;
    allowedOrigins: string[];
    jwtExpiresIn: string;
    databaseSslMode: DatabaseSslMode;
    databaseCaCertificate?: string;
}

export const resolveSecurityConfig = (env: NodeJS.ProcessEnv = process.env): SecurityConfig => {
    const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
    const isProduction = nodeEnv === 'production';
    const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const allowedOrigins = isProduction
        ? configuredOrigins
        : Array.from(new Set([...configuredOrigins, ...LOCAL_DEVELOPMENT_ORIGINS]));

    if (isProduction && allowedOrigins.length === 0) {
        throw new Error('ALLOWED_ORIGINS is required in production.');
    }

    const databaseSslMode =
        normalizeDatabaseSslMode(env.DATABASE_SSL_MODE) ||
        resolveLegacyDatabaseSslMode(env) ||
        (isProduction ? 'strict' : 'disable');

    if (isProduction && databaseSslMode === 'insecure') {
        throw new Error('DATABASE_SSL_MODE=insecure is not allowed in production.');
    }

    return {
        isProduction,
        allowedOrigins,
        jwtExpiresIn: String(env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN).trim() || DEFAULT_JWT_EXPIRES_IN,
        databaseSslMode,
        databaseCaCertificate: decodeCaCertificate(env.DATABASE_CA_CERT_BASE64),
    };
};

export const securityConfig = resolveSecurityConfig();

export const isOriginAllowed = (origin: string, config: SecurityConfig = securityConfig) =>
    config.allowedOrigins.includes(origin);

export const resolveDatabaseSslOptions = (
    config: SecurityConfig = securityConfig
): ConnectionOptions | undefined => {
    if (config.databaseSslMode === 'disable') {
        return undefined;
    }

    return {
        rejectUnauthorized: config.databaseSslMode === 'strict',
        ...(config.databaseCaCertificate ? { ca: config.databaseCaCertificate } : {}),
    };
};
