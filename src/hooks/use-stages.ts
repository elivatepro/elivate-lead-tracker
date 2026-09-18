"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";
import type { Stage } from "@/lib/types";

// Stages only change from a dedicated settings page, so they're worth
// caching longer than the default.
export function stagesQueryOptions() {
  return queryOptions({
    queryKey: ["stages"] as const,
    queryFn: async () => {
      const res = await fetch("/api/stages");
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json() as Promise<Stage[]>;
    },
    staleTime: 15 * 60 * 1000,
  });
}

export function useStages() {
  return useQuery(stagesQueryOptions());
}
