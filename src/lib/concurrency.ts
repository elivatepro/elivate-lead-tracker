export type ConcurrencyResult<T, R> = {
  item: T;
  ok: boolean;
  value?: R;
  error?: unknown;
};

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<ConcurrencyResult<T, R>[]> {
  const results: ConcurrencyResult<T, R>[] = new Array(items.length);

  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        const value = await fn(item);
        results[index] = { item, ok: true, value };
      } catch (error) {
        results[index] = { item, ok: false, error };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
