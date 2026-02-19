
import 'dotenv/config';
import prisma from './src/lib/prisma';

async function listUsers() {
    try {
        const users = await prisma.accounting.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                cnpj: true
            }
        });
        console.log('Total Accounting Users:', users.length);
        console.log('Users:', JSON.stringify(users, null, 2));
    } catch (error: any) {
        console.error('Error listing users:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
