const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUser() {
    try {
        // Check if user already exists
        const existingUser = await prisma.accounting.findUnique({
            where: { email: 'teste@teste.com' }
        });

        if (existingUser) {
            console.log('✅ Usuário de teste já existe!');
            console.log('📧 Email: teste@teste.com');
            console.log('🔑 Senha: teste123456');
            await prisma.$disconnect();
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('teste123456', 12);

        // Create test user
        const user = await prisma.accounting.create({
            data: {
                name: 'Escritório Teste',
                cnpj: '12.345.678/0001-90',
                email: 'teste@teste.com',
                phone: '11999999999',
                password_hash: hashedPassword,
                plan: 'premium',
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
    }
}

createTestUser();
