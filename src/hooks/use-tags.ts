"use client";

import { useQuery } from "@tanstack/react-query";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to load tags");
      const data = (await res.json()) as { tags: string[] };
      return data.tags;
    },
    staleTime: 60_000,
  });
}