import 'dotenv/config';
import prisma from './src/lib/prisma';

async function main() {
    console.log('START: Connecting to database...');
    try {
        const count = await prisma.accounting.count();
        console.log('Count:', count);
        const users = await prisma.accounting.findMany({ take: 5 });
        console.log('Users:', JSON.stringify(users, null, 2));
    } catch (e: any) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
        console.log('END: Disconnected.');
    }
}

main();
