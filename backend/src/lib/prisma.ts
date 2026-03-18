import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

// Opt-in only. Use DATABASE_SSL_INSECURE=true for local/self-signed certificates.
const insecureTls = process.env.DATABASE_SSL_INSECURE === 'true';
if (insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
    connectionString,
    ssl: insecureTls ? { rejectUnauthorized: false } : undefined,
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
