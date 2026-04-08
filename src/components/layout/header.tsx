"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header({ title }: { title: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/leads/list?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className="h-12 sm:h-14 border-b border-border/60 bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 gap-4">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight shrink-0">{title}</h1>
      <form onSubmit={handleSearch} className="relative w-full max-w-[220px] sm:max-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <Input
          placeholder="Search leads..."
          className="pl-9 h-8 sm:h-9 bg-secondary/40 border-transparent text-sm placeholder:text-muted-foreground/40 focus-visible:bg-white focus-visible:border-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
    </header>
  );
}
