"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { TUTORIAL_STEPS } from "@/lib/tutorial-steps";
import { hydrateFromStorage, useTutorialStore } from "@/store/tutorial.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { cn } from "@/lib/utils";

const PAD = 12;
const TOOLTIP_W = 360;
const TOOLTIP_H_APPROX = 280;
const OFFSET = 18;
const VIEWPORT_MARGIN = 16;
const TARGET_LOOKUP_TIMEOUT_MS = 8000;
const TUTORIAL_ROUTES = Array.from(new Set(TUTORIAL_STEPS.map((step) => step.route))) as Route[];

type Rect = { left: number; top: number; width: number; height: number };
type TooltipSize = { width: number; height: number };

function queryRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

type TooltipPos = { x: number; y: number; arrowDir: "top" | "bottom" | "left" | "right" | "none" };
type TooltipSide = Exclude<TooltipPos["arrowDir"], "none">;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function rectChanged(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a !== b;
  return (
    Math.abs(a.left - b.left) > 0.5 ||
    Math.abs(a.top - b.top) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5
  );
}

function inflatedRect(rect: Rect): Rect {
  return {
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2
  };
}

function intersectionArea(a: Rect, b: Rect) {
  const width = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return width * height;
}

function computeTooltipPos(
  rect: Rect | null,
  placement: string,
  vw: number,
  vh: number,
  size: TooltipSize
): TooltipPos {
  const width = Math.min(size.width || TOOLTIP_W, vw - VIEWPORT_MARGIN * 2);
  const height = Math.min(size.height || TOOLTIP_H_APPROX, vh - VIEWPORT_MARGIN * 2);

  if (!rect || placement === "center") {
    return {
      x: clamp((vw - width) / 2, VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
      y: clamp((vh - height) / 2, VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN),
      arrowDir: "none"
    };
  }

  const target = inflatedRect(rect);
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const spaces = {
    bottom: vh - (target.top + target.height) - OFFSET - VIEWPORT_MARGIN,
    top: target.top - OFFSET - VIEWPORT_MARGIN,
    right: vw - (target.left + target.width) - OFFSET - VIEWPORT_MARGIN,
    left: target.left - OFFSET - VIEWPORT_MARGIN
  };
  const sides: TooltipSide[] = ["top", "bottom", "right", "left"];
  const preferred = sides.includes(placement as TooltipSide) ? (placement as TooltipSide) : "bottom";
  const rankedSides = [...sides].sort((a, b) => spaces[b] - spaces[a]);
  const ordered = [preferred, ...rankedSides.filter((side) => side !== preferred)].filter(
    (side): side is TooltipSide => side === "top" || side === "bottom" || side === "right" || side === "left"
  );

  const candidate = (side: TooltipSide) => {
    if (side === "bottom") {
      return { x: cx - width / 2, y: target.top + target.height + OFFSET, arrowDir: "top" as const };
    }
    if (side === "top") {
      return { x: cx - width / 2, y: target.top - height - OFFSET, arrowDir: "bottom" as const };
    }
    if (side === "left") {
      return { x: target.left - width - OFFSET, y: cy - height / 2, arrowDir: "right" as const };
    }
    return { x: target.left + target.width + OFFSET, y: cy - height / 2, arrowDir: "left" as const };
  };

  for (const side of ordered) {
    const enoughSpace = side === "top" || side === "bottom" ? spaces[side] >= height : spaces[side] >= width;
    if (!enoughSpace) continue;
    const pos = candidate(side);
    return {
      x: clamp(pos.x, VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
      y: clamp(pos.y, VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN),
      arrowDir: pos.arrowDir
    };
  }

  return ordered
    .map((side) => {
      const pos = candidate(side);
      const clamped = {
        x: clamp(pos.x, VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
        y: clamp(pos.y, VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN),
        arrowDir: pos.arrowDir
      };
      return {
        ...clamped,
        overlap: intersectionArea({ left: clamped.x, top: clamped.y, width, height }, target)
      };
    })
    .sort((a, b) => a.overlap - b.overlap)[0]!;
}

function scrollTargetIntoView(rect: Rect, placement: string) {
  const pageTop = rect.top + window.scrollY;
  const pageBottom = pageTop + rect.height;
  const safeTooltipHeight = Math.min(TOOLTIP_H_APPROX, window.innerHeight - VIEWPORT_MARGIN * 2);
  const fitsVerticallyWithTooltip =
    rect.height + safeTooltipHeight + OFFSET + PAD + VIEWPORT_MARGIN * 2 <= window.innerHeight;
  let top: number;

  if (placement === "top" && fitsVerticallyWithTooltip) {
    top = pageTop - safeTooltipHeight - OFFSET - PAD - VIEWPORT_MARGIN;
  } else if (placement === "bottom" && fitsVerticallyWithTooltip) {
    top = pageBottom + safeTooltipHeight + OFFSET + PAD + VIEWPORT_MARGIN - window.innerHeight;
  } else {
    top = pageTop - (window.innerHeight - rect.height) / 2;
  }

  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function SpotlightOverlay({ rect }: { rect: Rect | null }) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  if (!rect) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[9990]"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(1px)" }}
      />
    );
  }

  const sx = rect.left - PAD;
  const sy = rect.top - PAD;
  const sw = rect.width + PAD * 2;
  const sh = rect.height + PAD * 2;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[9990]"
      style={{ width: vw, height: vh }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="arbix-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={sx} y={sy} width={sw} height={sh} rx="8" fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.72)"
        mask="url(#arbix-spotlight-mask)"
      />
      {/* Glowing border ring around the highlighted element */}
      <rect
        x={sx - 1}
        y={sy - 1}
        width={sw + 2}
        height={sh + 2}
        rx="9"
        fill="none"
        stroke="rgba(45,212,191,0.85)"
        strokeWidth="2"
        style={{
          filter: "drop-shadow(0 0 8px rgba(45,212,191,0.6)) drop-shadow(0 0 20px rgba(45,212,191,0.3))",
          transition: "x 0.35s ease, y 0.35s ease, width 0.35s ease, height 0.35s ease"
        }}
      />
    </svg>
  );
}

type TutorialTooltipProps = {
  stepIndex: number;
  total: number;
  rect: Rect | null;
  onNext: () => void;
  onBack: (() => void) | undefined;
  onSkip: () => void;
  isLastStep: boolean;
};

function TutorialTooltip({ stepIndex, total, rect, onNext, onBack, onSkip, isLastStep }: TutorialTooltipProps) {
  const step = TUTORIAL_STEPS[stepIndex];
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: TOOLTIP_W, height: TOOLTIP_H_APPROX });
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const pos = computeTooltipPos(rect, step?.placement ?? "center", vw, vh, tooltipSize);
  const progress = ((stepIndex + 1) / total) * 100;

  useEffect(() => {
    const node = tooltipRef.current;
    if (!node) return;

    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      setTooltipSize((current) =>
        Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5
          ? { width, height }
          : current
      );
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stepIndex]);

  if (!step) return null;

  return (
    <div
      ref={tooltipRef}
      key={`tip-${stepIndex}`}
      data-tutorial-tooltip
      className={cn(
        "pointer-events-auto fixed z-[9999] flex max-h-[calc(100vh-32px)] flex-col gap-3 overflow-auto rounded-xl border border-primary/30 shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(45,212,191,0.1)]",
        "bg-[#0a1220]/96 p-5 backdrop-blur-xl",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: TOOLTIP_W,
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            {step.gameText && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                {step.gameText}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          data-tour="tutorial-skip"
          onClick={onSkip}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          title="Exit tutorial"
          aria-label="Exit tutorial"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-base font-bold leading-snug text-foreground drop-shadow-[0_0_12px_rgba(45,212,191,0.2)]">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {total}
          </span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            data-tour="tutorial-back"
            onClick={onBack}
            className="gap-1.5 px-3"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          data-tour="tutorial-skip"
          onClick={onSkip}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          Skip tutorial
        </Button>
        <Button
          size="sm"
          data-tour="tutorial-next"
          onClick={onNext}
          className="gap-1.5 bg-primary/90 px-4 hover:bg-primary"
        >
          {isLastStep ? "Finish" : "Next"}
          {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {/* Keyboard shortcut hint */}
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/8 pt-2 text-[10px] text-muted-foreground/50">
        <span><kbd className="rounded border border-white/15 bg-white/8 px-1 py-0.5 font-mono">←</kbd> Back</span>
        <span><kbd className="rounded border border-white/15 bg-white/8 px-1 py-0.5 font-mono">→</kbd> Next</span>
        <span><kbd className="rounded border border-white/15 bg-white/8 px-1 py-0.5 font-mono">Esc</kbd> Skip</span>
      </div>
    </div>
  );
}

export function GuidedTutorial() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, currentStepIndex, nextStep, previousStep, skipTutorial, completeTutorial } =
    useTutorialStore();

  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const rafRef = useRef<number>(0);
  const lookupDeadlineRef = useRef(0);
  const lastRectRef = useRef<Rect | null>(null);
  const scrolledStepRef = useRef<string | null>(null);

  const step = TUTORIAL_STEPS[currentStepIndex];
  const totalSteps = TUTORIAL_STEPS.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Client-only mount guard (avoids hydration issues)
  useEffect(() => {
    setMounted(true);
    hydrateFromStorage();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const prefetchRoutes = () => {
      for (const route of TUTORIAL_ROUTES) {
        router.prefetch(route);
      }
    };

    const timer = window.setTimeout(prefetchRoutes, isActive ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [mounted, isActive, router]);

  useEffect(() => {
    if (!isActive || !step) return;

    for (const route of [step.route, TUTORIAL_STEPS[currentStepIndex + 1]?.route, TUTORIAL_STEPS[currentStepIndex + 2]?.route]) {
      if (route) router.prefetch(route as Route);
    }
  }, [isActive, currentStepIndex, step, router]);

  // Navigate to the correct route when step changes
  useEffect(() => {
    if (!isActive || !step) return;
    if (step.route && pathname !== step.route) {
      setNavigating(true);
      router.prefetch(step.route as Route);
      router.push(step.route as Route, { scroll: false });
    } else {
      setNavigating(false);
    }
  }, [isActive, currentStepIndex, step, pathname, router]);

  useEffect(() => {
    if (navigating && pathname === step?.route) {
      setNavigating(false);
    }
  }, [pathname, navigating, step?.route]);

  // Track target element position with rAF
  useEffect(() => {
    if (!isActive || !step?.targetSelector || navigating) {
      setRect(null);
      lastRectRef.current = null;
      scrolledStepRef.current = null;
      return;
    }

    lookupDeadlineRef.current = performance.now() + TARGET_LOOKUP_TIMEOUT_MS;
    lastRectRef.current = null;
    scrolledStepRef.current = null;
    cancelAnimationFrame(rafRef.current);

    const track = () => {
      const r = queryRect(step.targetSelector);
      if (r) {
        if (scrolledStepRef.current !== step.id) {
          scrollTargetIntoView(r, step.placement);
          scrolledStepRef.current = step.id;
        }
        if (rectChanged(r, lastRectRef.current)) {
          lastRectRef.current = r;
          setRect(r);
        }
        rafRef.current = requestAnimationFrame(track);
      } else if (performance.now() < lookupDeadlineRef.current) {
        rafRef.current = requestAnimationFrame(track);
      } else {
        // If a lazy route does not mount the target, keep the step usable in the center.
        lastRectRef.current = null;
        setRect(null);
      }
    };

    rafRef.current = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, currentStepIndex, step, navigating]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeTutorial();
    } else {
      nextStep(totalSteps);
    }
  }, [isLastStep, completeTutorial, nextStep, totalSteps]);

  const handleBack = useCallback(() => {
    previousStep();
  }, [previousStep]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTutorial();
      if (e.key === "ArrowRight" && !(step?.actionRequired)) handleNext();
      if (e.key === "ArrowLeft" && currentStepIndex > 0) handleBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, step, handleNext, handleBack, skipTutorial, currentStepIndex]);

  // Click-blocking — only active during steps with lockOtherActions: true
  useEffect(() => {
    if (!isActive || !step?.lockOtherActions) return;

    const allowed = step.allowedSelectors ?? [];

    const handleCapture = (e: MouseEvent) => {
      const target = e.target as Element;

      // Always allow interaction with the tutorial tooltip panel itself
      if (target.closest("[data-tutorial-tooltip]")) return;

      // Allow explicitly whitelisted selectors (target element, tutorial controls)
      if (allowed.some((sel) => target.closest(sel))) return;

      // Allow clicks that land inside the spotlight rectangle
      if (rect) {
        const inside =
          e.clientX >= rect.left - PAD &&
          e.clientX <= rect.left + rect.width + PAD &&
          e.clientY >= rect.top - PAD &&
          e.clientY <= rect.top + rect.height + PAD;
        if (inside) return;
      }

      e.stopPropagation();
      e.preventDefault();
      toast.info(
        "Tutorial in progress",
        'Complete this step or press "Skip tutorial" to interact freely.'
      );
    };

    document.addEventListener("click", handleCapture, { capture: true });
    return () => document.removeEventListener("click", handleCapture, { capture: true });
  }, [isActive, step, rect]);

  // Auto-advance for action-required steps
  useEffect(() => {
    if (!isActive || !step?.actionRequired) return;

    if (step.id === "start-bot") {
      // If already running, advance after a short pause so the user sees the highlight
      const current = useMarketStore.getState();
      if (current.bot.status === "RUNNING" && current.bot.connected) {
        const t = window.setTimeout(() => nextStep(totalSteps), 600);
        return () => window.clearTimeout(t);
      }

      let advanced = false;
      const unsubscribe = useMarketStore.subscribe((state) => {
        if (!advanced && state.bot.status === "RUNNING" && state.bot.connected) {
          advanced = true;
          unsubscribe();
          window.setTimeout(() => nextStep(totalSteps), 900);
        }
      });
      return unsubscribe;
    }

    if (step.id === "demo-scenario") {
      const initialExecuted = useOpportunitiesStore
        .getState()
        .opportunities.filter((o) => o.status === "EXECUTED").length;

      let advanced = false;
      const unsubscribe = useOpportunitiesStore.subscribe((state) => {
        const current = state.opportunities.filter((o) => o.status === "EXECUTED").length;
        if (!advanced && current > initialExecuted) {
          advanced = true;
          unsubscribe();
          window.setTimeout(() => nextStep(totalSteps), 1200);
        }
      });
      return unsubscribe;
    }

    if (step.id === "chatbot") {
      let advanced = false;
      const handler = () => {
        if (advanced) return;
        advanced = true;
        window.setTimeout(() => nextStep(totalSteps), 900);
      };
      window.addEventListener("arbix:chatbot-opened", handler, { once: true });
      return () => window.removeEventListener("arbix:chatbot-opened", handler);
    }
  }, [isActive, currentStepIndex, step, nextStep, totalSteps]);

  if (!isActive || !mounted || !step) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9988]">
      <SpotlightOverlay rect={rect} />
      <TutorialTooltip
        stepIndex={currentStepIndex}
        total={totalSteps}
        rect={rect}
        onNext={handleNext}
        onBack={currentStepIndex > 0 ? handleBack : undefined}
        onSkip={skipTutorial}
        isLastStep={isLastStep}
      />
    </div>,
    document.body
  );
}

/** Button that opens the tutorial from anywhere */
export function TutorialButton({ className }: { className?: string }) {
  const { startTutorial } = useTutorialStore();
  return (
    <button
      type="button"
      onClick={startTutorial}
      className={cn(
        "flex h-10 items-center gap-3 overflow-hidden rounded-md border border-transparent px-3 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-white/10 hover:text-foreground w-full",
        className
      )}
    >
      <GraduationCap className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
      <span className="flex-1 text-left">Tutorial</span>
      <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
        Guide
      </span>
    </button>
  );
}
