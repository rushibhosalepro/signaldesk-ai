import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "sev1" | "sev2" | "sev3" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-white text-black",
  sev1: "bg-red-500 text-white",
  sev2: "bg-yellow-500 text-black",
  sev3: "bg-neutral-600 text-white",
  outline: "border border-neutral-600 text-neutral-300 bg-transparent",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
