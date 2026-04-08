import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={44}
            height={44}
            priority
          />
          <div className="text-center">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">
              LeadTracker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">by Elivate</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
