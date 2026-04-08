import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  href?: string;
  accent?: string;
}

export function StatCard({
  title,
  value,
  description,
  href,
  accent,
}: StatCardProps) {
  const content = (
    <Card
      className={`relative overflow-hidden ${href ? "hover:shadow-md hover:-translate-y-px transition-all cursor-pointer" : "transition-shadow"}`}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{ backgroundColor: accent || "#e8e2d4" }}
      />
      <CardContent className="pt-4 sm:pt-5 pb-3 sm:pb-4 px-3 sm:px-5">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          {title}
        </p>
        <p className="text-xl sm:text-[28px] font-semibold tracking-tight mt-1 leading-none">
          {value}
        </p>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 mt-1.5 sm:mt-2 hidden sm:block">
          {description}
        </p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
