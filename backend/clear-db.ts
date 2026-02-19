
import 'dotenv/config';
import prisma from './src/lib/prisma';

async function clearDB() {
    console.log('START: Clearing database...');
    try {
        // Order matters due to foreign keys
        const clients = await prisma.client.deleteMany();
        console.log(`Deleted ${clients.count} clients.`);
        
        const accounts = await prisma.accounting.deleteMany();
        console.log(`Deleted ${accounts.count} accounts.`);
        
        console.log('✅ Database cleared successfully!');
    } catch (e: any) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
        console.log('END: Disconnected.');
    }
}

clearDB();
