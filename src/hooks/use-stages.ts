"use client";

import { useQuery } from "@tanstack/react-query";
import type { Stage } from "@/lib/types";

export function useStages() {
  return useQuery<Stage[]>({
    queryKey: ["stages"],
    queryFn: async () => {
      const res = await fetch("/api/stages");
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
  });
}
