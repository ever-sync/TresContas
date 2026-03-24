import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { resolveDatabaseSslOptions, securityConfig } from './src/config/security';
import { normalizeDatabaseConnectionString } from './src/lib/databaseUrl';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
    connectionString: normalizeDatabaseConnectionString(connectionString, securityConfig.databaseSslMode),
    ssl: resolveDatabaseSslOptions(securityConfig),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createTestUser() {
    try {
        // Check if accounting already exists
        let accounting = await prisma.accounting.findUnique({
            where: { email: 'contato@escritorioteste.com' }
        });

        if (!accounting) {
            accounting = await prisma.accounting.create({
                data: {
                    name: 'Escritório Teste',
                    cnpj: '12.345.678/0001-90',
                    email: 'contato@escritorioteste.com',
                    phone: '11999999999',
                    plan: 'premium',
                },
            });
            console.log('✅ Escritório de teste criado!');
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: 'teste@teste.com' }
        });

        if (existingUser) {
            console.log('✅ Usuário de teste já existe!');
            console.log('📧 Email: teste@teste.com');
            console.log('🔑 Senha: teste123456');
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('teste123456', 12);

        // Create test user
        const user = await prisma.user.create({
            data: {
                accounting_id: accounting.id,
                name: 'Usuário Teste',
                email: 'teste@teste.com',
                password_hash: hashedPassword,
                role: 'admin',
                status: 'active',
            },
        });

        console.log('✅ Usuário de teste criado com sucesso!');
        console.log('📧 Email: teste@teste.com');
        console.log('🔑 Senha: teste123456');
        console.log('👤 Nome:', user.name);
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

createTestUser();
