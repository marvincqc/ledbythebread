// Module-level cache — survives component unmount/remount within a session.
// Cached data is shown instantly on revisit while a background refetch runs.
const _cache = new Map<string, unknown>();

export const pageCache = {
  get<T>(key: string): T | null {
    return (_cache.get(key) as T) ?? null;
  },
  set(key: string, data: unknown) {
    _cache.set(key, data);
  },
  clear(key: string) {
    _cache.delete(key);
  },
};
