// A one-use, in-memory handoff from the launcher to its selected workspace.
// Exact session/epoch/workspace keys prevent reuse across users or later reads.
export function createBootstrapSeed<T>() {
  let value: { key: string; data: T } | undefined;
  return {
    offer(key: string, data: T) { value = {key, data}; },
    take(key: string): T | undefined {
      const previous = value;
      value = undefined;
      return previous?.key === key ? previous.data : undefined;
    },
    clear() { value = undefined; },
  };
}
