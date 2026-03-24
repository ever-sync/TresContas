import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import {
    buildDocumentStoragePath,
    deleteDocumentStorage,
    writeDocumentStorage,
} from '../lib/documentStorage';

const BATCH_SIZE = 100;

const main = async () => {
    let migrated = 0;

    while (true) {
        const documents = await prisma.$queryRaw<Array<{
            id: string;
            accounting_id: string;
            client_id: string;
            original_name: string;
            content: Buffer;
        }>>(Prisma.sql`
            SELECT
                id,
                accounting_id,
                client_id,
                original_name,
                content
            FROM "ClientDocument"
            WHERE storage_path IS NULL
              AND content IS NOT NULL
            ORDER BY created_at ASC
            LIMIT ${BATCH_SIZE}
        `);

        if (documents.length === 0) {
            break;
        }

        for (const document of documents) {
            const storagePath = buildDocumentStoragePath(
                document.accounting_id,
                document.client_id,
                document.id
            );

            const content = Buffer.from(document.content as Buffer);

            try {
                await writeDocumentStorage(storagePath, content);

                await prisma.$executeRaw(Prisma.sql`
                    UPDATE "ClientDocument"
                    SET storage_path = ${storagePath},
                        content = ${null}
                    WHERE id = ${document.id}
                `);

                migrated += 1;
                console.log(`Migrated ${document.original_name} (${migrated} total)`);
            } catch (error) {
                await deleteDocumentStorage(storagePath);
                throw error;
            }
        }
    }

    console.log(`Migration complete. ${migrated} document(s) moved to filesystem storage.`);
};

main()
    .catch((error) => {
        console.error('Failed to migrate client documents:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
