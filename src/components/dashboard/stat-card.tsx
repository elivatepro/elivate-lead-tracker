import Link from "next/link";

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
    <div
      className={`relative overflow-hidden rounded-[3px] border border-line bg-card px-4 pb-4 pt-4 shadow-[0_2px_8px_rgba(38,28,18,0.04)] ${
        href ? "transition-colors hover:border-line-3" : ""
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ backgroundColor: accent || "#e8e2d4" }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
        {title}
      </p>
      <p className="numeric mt-2.5 font-display text-[30px] leading-none tracking-[-0.03em] text-ink sm:text-[34px]">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-ink-4">{description}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
