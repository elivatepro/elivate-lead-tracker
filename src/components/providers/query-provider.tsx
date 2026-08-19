"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";

const CACHE_KEY = "leadtracker.cache";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Queries whose data is worth persisting locally for an instant first paint.
const PERSISTED_ROOTS = new Set(["leads", "stages", "workspace", "dashboard", "tags"]);

function createPersister(): ReturnType<typeof createSyncStoragePersister> {
  if (typeof window === "undefined") {
    const noop: Storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    return createSyncStoragePersister({ storage: noop, key: CACHE_KEY });
  }
  return createSyncStoragePersister({ storage: window.localStorage, key: CACHE_KEY });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [persister] = useState(createPersister);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            PERSISTED_ROOTS.has(query.queryKey[0] as string),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}