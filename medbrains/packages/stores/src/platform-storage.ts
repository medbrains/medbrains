import type { StateStorage } from "zustand/middleware";

function browserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return typeof window.sessionStorage === "undefined" ? null : window.sessionStorage;
}

export function createSessionStorageAdapter(): StateStorage {
  const memory = new Map<string, string>();

  return {
    getItem: (name) => {
      const storage = browserSessionStorage();
      if (storage) return storage.getItem(name);
      return memory.get(name) ?? null;
    },
    removeItem: (name) => {
      const storage = browserSessionStorage();
      if (storage) {
        storage.removeItem(name);
        return;
      }
      memory.delete(name);
    },
    setItem: (name, value) => {
      const storage = browserSessionStorage();
      if (storage) {
        storage.setItem(name, value);
        return;
      }
      memory.set(name, value);
    },
  };
}
