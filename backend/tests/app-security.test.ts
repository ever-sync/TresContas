import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    accounting: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
        create: vi.fn(),
    },
    client: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
    },
    $transaction: vi.fn(),
};

const bcryptMock = {
    hash: vi.fn(),
    compare: vi.fn(),
};

vi.mock('../src/lib/prisma', () => ({
    default: prismaMock,
}));

vi.mock('bcryptjs', () => ({
    default: bcryptMock,
}));

vi.mock('groq-sdk', () => ({
    default: class GroqMock {
        chat = {
            completions: {
                create: vi.fn(),
            },
        };
    },
}));

const ORIGINAL_ENV = { ...process.env };

const loadApp = async () => {
    vi.resetModules();
    process.env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        VERCEL: '1',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/trescontas',
        JWT_SECRET: 'test-secret',
        GROQ_API_KEY: 'test-key',
        ALLOWED_ORIGINS: 'https://allowed.example.com',
        DATABASE_SSL_MODE: 'strict',
        DATABASE_SSL_INSECURE: '',
        DATABASE_SSL_STRICT: '',
        PG_SSL_REJECT_UNAUTHORIZED: '',
    };

    const mod = await import('../src/index');
    return mod.default;
};

beforeEach(() => {
    prismaMock.accounting.findFirst.mockReset();
    prismaMock.accounting.create.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.client.findUnique.mockReset();
    prismaMock.client.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    bcryptMock.hash.mockReset();
    bcryptMock.compare.mockReset();
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
});

describe('app security', () => {
    it('allows configured origin and returns CORS headers', async () => {
        const app = await loadApp();

        const response = await request(app)
            .get('/health')
            .set('Origin', 'https://allowed.example.com');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
        expect(response.headers.vary).toContain('Origin');
    });

    it('blocks an origin outside the allowlist', async () => {
        const app = await loadApp();

        const response = await request(app)
            .get('/health')
            .set('Origin', 'https://blocked.example.com');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: 'Origin nao permitida' });
    });

    it('allows requests without origin header', async () => {
        const app = await loadApp();

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('returns expires_at in login responses', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-1',
            accounting_id: 'accounting-1',
            role: 'admin',
            status: 'active',
            name: 'Raphael',
            email: 'raphael@example.com',
            password_hash: 'hashed-password',
            accounting: {
                name: 'TresContas',
                cnpj: '12345678000199',
            },
        });
        bcryptMock.compare.mockResolvedValue(true);

        const app = await loadApp();
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'raphael@example.com', password: 'strong-password' });

        expect(response.status).toBe(200);
        expect(response.body.token).toEqual(expect.any(String));
        expect(response.body.expires_at).toEqual(expect.any(String));
        expect(Number.isNaN(Date.parse(response.body.expires_at))).toBe(false);
    });

    it('rate limits repeated login attempts', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const app = await loadApp();
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'raphael@example.com', password: 'wrong-password' });

            expect(response.status).toBe(401);
        }

        const blockedResponse = await request(app)
            .post('/api/auth/login')
            .send({ email: 'raphael@example.com', password: 'wrong-password' });

        expect(blockedResponse.status).toBe(429);
        expect(blockedResponse.body).toEqual({
            message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
        });
    });
});
