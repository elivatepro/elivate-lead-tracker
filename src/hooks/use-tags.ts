"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";

export function tagsQueryOptions() {
  return queryOptions({
    queryKey: ["tags"] as const,
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to load tags");
      const data = (await res.json()) as { tags: string[] };
      return data.tags;
    },
    staleTime: 60_000,
  });
}

export function useTags() {
  return useQuery(tagsQueryOptions());
}