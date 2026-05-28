import logoSrc from "@/assets/open-trader-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

/**
 * Open Trader logo — mascot mark (GitHub Octocat-style) + optional wordmark.
 * Mark is a transparent PNG of the brand creature; wordmark is set in code.
 */
export function Logo({ size = 28, withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30"
        style={{ width: size, height: size }}
      >
        <img
          src={logoSrc}
          alt="Open Trader logo"
          width={size}
          height={size}
          className="h-[78%] w-[78%] object-contain"
          loading="lazy"
        />
      </span>
      {withWordmark && (
        <span className="text-sm font-semibold tracking-tight">
          Open<span className="text-primary">Trader</span>
        </span>
      )}
    </span>
  );
}
