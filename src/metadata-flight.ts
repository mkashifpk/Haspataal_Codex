// Share only concurrent metadata reads of the exact session/workspace context.
// Completed or failed reads are never cached; business writes do not use this.
export function createMetadataFlight() {
  const active = new Map<string, Promise<void>>();
  return (key: string, read: () => Promise<void>): Promise<void> => {
    const existing = active.get(key);
    if (existing) return existing;
    const pending = Promise.resolve().then(read).finally(() => {
      if (active.get(key) === pending) active.delete(key);
    });
    active.set(key, pending);
    return pending;
  };
}
