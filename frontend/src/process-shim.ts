type ProcessLike = {
    env?: Record<string, string>;
};

const globalWithProcess = globalThis as typeof globalThis & { process?: ProcessLike };
const processGlobal = globalWithProcess.process ?? (globalWithProcess.process = {});

processGlobal.env = processGlobal.env ?? {};
processGlobal.env.NODE_ENV = import.meta.env.MODE;

export {};
