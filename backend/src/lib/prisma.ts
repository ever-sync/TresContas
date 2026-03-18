import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const runningOnVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const forceInsecureTls = process.env.DATABASE_SSL_INSECURE === 'true';
const forceStrictTls = process.env.DATABASE_SSL_STRICT === 'true';
const explicitRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED;
const urlRequestsSsl = /(?:\?|&)(sslmode|ssl)=/i.test(connectionString);

// In Vercel/serverless, managed Postgres providers often require explicit SSL handling.
const shouldUseSsl = forceInsecureTls || forceStrictTls || runningOnVercel || urlRequestsSsl;
const rejectUnauthorized = forceStrictTls
    ? true
    : explicitRejectUnauthorized === 'false'
        ? false
        : explicitRejectUnauthorized === 'true'
            ? true
            : !(forceInsecureTls || runningOnVercel);

if (shouldUseSsl && !rejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
    max: 10,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
    transactionOptions: {
        maxWait: 10000,   // 10s esperando conexão
        timeout: 30000,   // 30s para executar a transaction
    },
});

export const getPool = () => pool;
export default prisma;
