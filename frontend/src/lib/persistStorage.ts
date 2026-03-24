import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const memoryStorage: StateStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};

const getSessionStorage = (): StateStorage => {
    if (typeof window === 'undefined') {
        return memoryStorage;
    }

    try {
        return window.sessionStorage;
    } catch {
        return memoryStorage;
    }
};

export const sessionStorageJSON = createJSONStorage(getSessionStorage);
