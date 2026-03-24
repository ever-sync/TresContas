import type { ConnectionOptions } from 'tls';

export type DatabaseSslMode = 'strict' | 'insecure' | 'disable';
export type AuthCookieSameSite = 'lax' | 'strict' | 'none';

const LOCAL_DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const VALID_DATABASE_SSL_MODES: DatabaseSslMode[] = ['strict', 'insecure', 'disable'];
const VALID_AUTH_COOKIE_SAME_SITE: AuthCookieSameSite[] = ['lax', 'strict', 'none'];
const DEFAULT_AUTH_ACCESS_TTL = '12h';
const DEFAULT_AUTH_REFRESH_TTL = '7d';
const DEFAULT_ACCOUNT_ACTION_TTL = '24h';

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

const parseDurationToMs = (value: string, fallbackLabel: string) => {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/);
    if (!match) {
        throw new Error(`Invalid ${fallbackLabel} "${value}". Use a number followed by ms, s, m, h or d.`);
    }

    const amount = Number(match[1]);
    const unit = match[2] || 'ms';

    switch (unit) {
        case 'ms':
            return amount;
        case 's':
            return amount * 1000;
        case 'm':
            return amount * 60 * 1000;
        case 'h':
            return amount * 60 * 60 * 1000;
        case 'd':
            return amount * 24 * 60 * 60 * 1000;
        default:
            throw new Error(`Invalid ${fallbackLabel} "${value}".`);
    }
};

const normalizeAuthCookieSameSite = (value: string | undefined): AuthCookieSameSite => {
    if (!value) return 'lax';

    const normalized = value.trim().toLowerCase();
    if (VALID_AUTH_COOKIE_SAME_SITE.includes(normalized as AuthCookieSameSite)) {
        return normalized as AuthCookieSameSite;
    }

    throw new Error(`Invalid AUTH_COOKIE_SAME_SITE "${value}". Use one of: ${VALID_AUTH_COOKIE_SAME_SITE.join(', ')}.`);
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
    authAccessTtl: string;
    authAccessTtlMs: number;
    authRefreshTtl: string;
    authRefreshTtlMs: number;
    accountActionTtl: string;
    accountActionTtlMs: number;
    authCookieDomain?: string;
    authCookieSecure: boolean;
    authCookieSameSite: AuthCookieSameSite;
    databaseSslMode: DatabaseSslMode;
    databaseCaCertificate?: string;
}

export const resolveSecurityConfig = (env: NodeJS.ProcessEnv = process.env): SecurityConfig => {
    const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
    const isProduction = nodeEnv === 'production';
    const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || env.CORS_ORIGIN);
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
        jwtExpiresIn: String(env.AUTH_ACCESS_TTL || env.JWT_EXPIRES_IN || DEFAULT_AUTH_ACCESS_TTL).trim() || DEFAULT_AUTH_ACCESS_TTL,
        authAccessTtl: String(env.AUTH_ACCESS_TTL || env.JWT_EXPIRES_IN || DEFAULT_AUTH_ACCESS_TTL).trim() || DEFAULT_AUTH_ACCESS_TTL,
        authAccessTtlMs: parseDurationToMs(
            String(env.AUTH_ACCESS_TTL || env.JWT_EXPIRES_IN || DEFAULT_AUTH_ACCESS_TTL).trim() || DEFAULT_AUTH_ACCESS_TTL,
            'AUTH_ACCESS_TTL'
        ),
        authRefreshTtl: String(env.AUTH_REFRESH_TTL || DEFAULT_AUTH_REFRESH_TTL).trim() || DEFAULT_AUTH_REFRESH_TTL,
        authRefreshTtlMs: parseDurationToMs(
            String(env.AUTH_REFRESH_TTL || DEFAULT_AUTH_REFRESH_TTL).trim() || DEFAULT_AUTH_REFRESH_TTL,
            'AUTH_REFRESH_TTL'
        ),
        accountActionTtl: String(env.ACCOUNT_ACTION_TTL || DEFAULT_ACCOUNT_ACTION_TTL).trim() || DEFAULT_ACCOUNT_ACTION_TTL,
        accountActionTtlMs: parseDurationToMs(
            String(env.ACCOUNT_ACTION_TTL || DEFAULT_ACCOUNT_ACTION_TTL).trim() || DEFAULT_ACCOUNT_ACTION_TTL,
            'ACCOUNT_ACTION_TTL'
        ),
        authCookieDomain: env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
        authCookieSecure: env.AUTH_COOKIE_SECURE ? toBoolean(env.AUTH_COOKIE_SECURE) : isProduction,
        authCookieSameSite: normalizeAuthCookieSameSite(env.AUTH_COOKIE_SAME_SITE),
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
