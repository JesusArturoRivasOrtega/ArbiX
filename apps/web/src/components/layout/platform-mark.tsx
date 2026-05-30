import Image from "next/image";
import { cn } from "@/lib/utils";

type PlatformMarkProps = {
  className?: string;
  imageClassName?: string;
  size?: number;
  priority?: boolean;
};

export function PlatformMark({ className, imageClassName, size = 44, priority = false }: PlatformMarkProps) {
  return (
    <div
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/35 bg-[#060a10] shadow-[0_0_30px_rgba(45,212,191,0.16)]",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/arbix-platform-icon-192.png"
        alt="ArbiX"
        width={size}
        height={size}
        priority={priority}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
      <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-white/10" />
    </div>
  );
}
