type ProcessLike = {
    env?: Record<string, string>;
};

const globalWithProcess = globalThis as typeof globalThis & { process?: ProcessLike };
const processGlobal = globalWithProcess.process ?? (globalWithProcess.process = {});

processGlobal.env = processGlobal.env ?? {};

try {
    processGlobal.env.NODE_ENV = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE || 'development';
} catch {
    processGlobal.env.NODE_ENV = 'development';
}

export {};
