import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadSecurityModule = async (overrides: NodeJS.ProcessEnv = {}) => {
    vi.resetModules();
    process.env = {
        ...ORIGINAL_ENV,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/trescontas',
        JWT_SECRET: 'test-secret',
        DATABASE_SSL_MODE: '',
        DATABASE_SSL_INSECURE: '',
        DATABASE_SSL_STRICT: '',
        PG_SSL_REJECT_UNAUTHORIZED: '',
        ...overrides,
    };

    return import('../src/config/security');
};

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
});

describe('security config', () => {
    it('defaults to strict SSL in production', async () => {
        const { resolveSecurityConfig } = await loadSecurityModule({
            NODE_ENV: 'production',
            ALLOWED_ORIGINS: 'https://app.example.com',
        });

        const config = resolveSecurityConfig(process.env);
        expect(config.databaseSslMode).toBe('strict');
    });

    it('rejects insecure SSL in production', async () => {
        await expect(
            loadSecurityModule({
                NODE_ENV: 'production',
                ALLOWED_ORIGINS: 'https://app.example.com',
                DATABASE_SSL_MODE: 'insecure',
            })
        ).rejects.toThrow('DATABASE_SSL_MODE=insecure is not allowed in production.');
    });

    it('allows insecure SSL outside production', async () => {
        const { resolveSecurityConfig, resolveDatabaseSslOptions } = await loadSecurityModule({
            NODE_ENV: 'development',
            DATABASE_SSL_MODE: 'insecure',
        });

        const config = resolveSecurityConfig(process.env);
        expect(config.databaseSslMode).toBe('insecure');
        expect(resolveDatabaseSslOptions(config)).toMatchObject({ rejectUnauthorized: false });
    });
});
