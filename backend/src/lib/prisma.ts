import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolveDatabaseSslOptions, securityConfig } from '../config/security';
import { normalizeDatabaseConnectionString } from './databaseUrl';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const normalizedConnectionString = normalizeDatabaseConnectionString(
    connectionString,
    securityConfig.databaseSslMode
);
const ssl = resolveDatabaseSslOptions(securityConfig);

const pool = new Pool({
    connectionString: normalizedConnectionString,
    ssl,
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
