/** In-memory stand-ins for the Workers Cache API and KV. */
export class MemoryCache {
  store = new Map<string, Response>();
  async match(key: RequestInfo | URL): Promise<Response | undefined> {
    const k = typeof key === 'string' ? key : key instanceof URL ? key.toString() : key.url;
    const r = this.store.get(k);
    return r ? r.clone() : undefined;
  }
  async put(key: RequestInfo | URL, res: Response): Promise<void> {
    const k = typeof key === 'string' ? key : key instanceof URL ? key.toString() : key.url;
    this.store.set(k, res.clone());
  }
}

export class MemoryKV {
  store = new Map<string, { value: string; metadata: unknown }>();
  puts = 0;
  async get(key: string, type?: string) {
    const v = this.store.get(key);
    if (!v) return null;
    return type === 'json' ? JSON.parse(v.value) : v.value;
  }
  async getWithMetadata(key: string) {
    const v = this.store.get(key);
    return { value: v?.value ?? null, metadata: v?.metadata ?? null };
  }
  async put(key: string, value: string, opts?: { metadata?: unknown }) {
    this.puts++;
    this.store.set(key, { value, metadata: opts?.metadata ?? null });
  }
}

/** Collects waitUntil promises so a test can await them. */
export function waiter() {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => void pending.push(p), flush: () => Promise.all(pending.splice(0)) };
}
