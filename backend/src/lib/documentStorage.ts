import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const DEFAULT_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'client-documents');

const getStorageRoot = () => {
    const configuredRoot = process.env.DOCUMENT_STORAGE_PATH?.trim();
    return configuredRoot ? path.resolve(configuredRoot) : DEFAULT_STORAGE_ROOT;
};

export const buildDocumentStoragePath = (accountingId: string, clientId: string, documentId: string) =>
    path.join(getStorageRoot(), accountingId, clientId, `${documentId}.bin`);

export const writeDocumentStorage = async (storagePath: string, content: Buffer) => {
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, content);
};

export const readDocumentStorage = async (
    storagePath: string | null | undefined,
    fallbackContent: Buffer | null
) => {
    if (storagePath) {
        try {
            return await readFile(storagePath);
        } catch {
            return fallbackContent;
        }
    }

    return fallbackContent;
};

export const deleteDocumentStorage = async (storagePath: string | null | undefined) => {
    if (!storagePath) return;

    try {
        await unlink(storagePath);
    } catch {
        // Ignore missing files when cleaning up failed uploads.
    }
};
