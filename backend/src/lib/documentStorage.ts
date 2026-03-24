import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const DEFAULT_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'client-documents');

export interface DocumentStorageAdapter {
    buildStorageLocation: (accountingId: string, clientId: string, documentId: string) => string;
    write: (storageLocation: string, content: Buffer) => Promise<void>;
    read: (storageLocation: string | null | undefined, fallbackContent: Buffer | null) => Promise<Buffer | null>;
    delete: (storageLocation: string | null | undefined) => Promise<void>;
}

export const getDocumentStorageRoot = () => {
    const configuredRoot = process.env.DOCUMENT_STORAGE_PATH?.trim();
    return configuredRoot ? path.resolve(configuredRoot) : DEFAULT_STORAGE_ROOT;
};

const buildFilesystemLocation = (accountingId: string, clientId: string, documentId: string) =>
    path.join(getDocumentStorageRoot(), accountingId, clientId, `${documentId}.bin`);

const filesystemDocumentStorageAdapter: DocumentStorageAdapter = {
    buildStorageLocation: buildFilesystemLocation,
    write: async (storageLocation: string, content: Buffer) => {
        await mkdir(path.dirname(storageLocation), { recursive: true });
        await writeFile(storageLocation, content);
    },
    read: async (storageLocation: string | null | undefined, fallbackContent: Buffer | null) => {
        if (storageLocation) {
            try {
                return await readFile(storageLocation);
            } catch {
                return fallbackContent;
            }
        }

        return fallbackContent;
    },
    delete: async (storageLocation: string | null | undefined) => {
        if (!storageLocation) return;

        try {
            await unlink(storageLocation);
        } catch {
            // Ignore missing files when cleaning up failed uploads.
        }
    },
};

export const documentStorageAdapter = filesystemDocumentStorageAdapter;

export const buildDocumentStoragePath = documentStorageAdapter.buildStorageLocation;

export const writeDocumentStorage = async (storagePath: string, content: Buffer) => {
    await documentStorageAdapter.write(storagePath, content);
};

export const readDocumentStorage = async (
    storagePath: string | null | undefined,
    fallbackContent: Buffer | null
) => documentStorageAdapter.read(storagePath, fallbackContent);

export const deleteDocumentStorage = async (storagePath: string | null | undefined) => {
    await documentStorageAdapter.delete(storagePath);
};

export const ensureDocumentStorageRoot = async () => {
    await mkdir(getDocumentStorageRoot(), { recursive: true });
};
