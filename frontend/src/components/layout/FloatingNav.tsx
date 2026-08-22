import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChrome } from "@/contexts/ChromeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PIPELINE, WORKSPACE_ITEMS, isUnlocked, type NavItem } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/**
 * Floating dock navigation.
 *
 * Replaces the fixed sidebar. Pipeline steps the operator hasn't unlocked yet
 * are rendered locked rather than hidden, so the shape of the whole run is
 * visible from the first screen — and each locked item says what it is waiting
 * for. The active pill is a shared layout element, so moving between tabs
 * slides rather than cuts.
 *
 * The dock drops away while the operator scrolls down — a long page (the
 * contact table, a grid of segments) is worth the full window — and returns on
 * the first upward scroll, or from the handle below.
 */
function NavButton({ item, unlocked }: { item: NavItem; unlocked: boolean }) {
  const { pathname } = useLocation();
  const isActive = pathname === item.to;

  const inner = (
    <div
      className={cn(
        "relative flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium select-none",
        "transition-colors duration-200",
        !unlocked
          ? "text-foreground/25 cursor-not-allowed"
          : isActive
            ? "text-primary"
            : "text-foreground/60 hover:text-foreground",
      )}
    >
      {isActive && unlocked && (
        <motion.div
          layoutId="floating-nav-active"
          className="absolute inset-0 glass-nav-active rounded-full"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {!unlocked ? (
        <Lock className="h-3.5 w-3.5 relative z-10 shrink-0" />
      ) : (
        <item.icon className="h-4 w-4 relative z-10 shrink-0" />
      )}
      <span className="relative z-10 whitespace-nowrap">{item.label}</span>
    </div>
  );

  if (!unlocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled anchor still navigates on Enter, so a locked step is a
              plain div — there is nothing to focus and nowhere to go. */}
          <div aria-disabled className="opacity-100">
            {inner}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          {item.requirement ?? "Not available yet"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <NavLink to={item.to} className="outline-none rounded-full focus-visible:ring-2 focus-visible:ring-primary/40">
      {inner}
    </NavLink>
  );
}

/**
 * The way back to a dock that has scrolled away.
 *
 * Without it the only route back is to scroll up, which is the wrong gesture
 * when the operator is already at the bottom of a long page.
 */
export function NavPeekHandle() {
  const { navHidden, revealNav } = useChrome();

  return (
    <AnimatePresence>
      {navHidden && (
        <motion.div
          key="nav-peek"
          initial={{ y: 22, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 22, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute bottom-2.5 left-1/2 z-30"
        >
          <button type="button" onClick={revealNav} aria-label="Show navigation" className="nav-peek">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FloatingNav() {
  const { state } = useWorkspace();
  const { navHidden } = useChrome();

  return (
    <TooltipProvider delayDuration={150}>
      <motion.nav
        initial={{ y: 28, opacity: 0 }}
        animate={navHidden ? { y: 104, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        aria-hidden={navHidden}
        className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4"
      >
        <div
          className={cn(
            // No vertical padding: .floating-dock owns the height (shared with
            // the Next button) and centres its row inside it.
            "floating-dock flex items-center gap-1 pl-3 pr-2 max-w-full overflow-x-auto scrollbar-none",
            // Off-screen it is clipped by the shell, but a stray click on the
            // sliver mid-transition would still navigate.
            navHidden ? "pointer-events-none" : "pointer-events-auto",
          )}
        >
          {/* mosaic_logo_cropped.png is the mark with its white margin removed;
              `multiply` drops the remaining near-white ground into the glass. */}
          <img
            src="/mosaic_logo_cropped.png"
            alt="MOSAIC"
            draggable={false}
            className="h-6 w-auto shrink-0 mr-1.5 pointer-events-none select-none"
            style={{ mixBlendMode: "multiply" }}
          />

          <div className="h-6 w-px bg-foreground/10 shrink-0 mr-1" />

          {PIPELINE.map((item) => (
            <NavButton key={item.to} item={item} unlocked={isUnlocked(item, state)} />
          ))}

          <div className="h-6 w-px bg-foreground/10 shrink-0 mx-1" />

          {WORKSPACE_ITEMS.map((item) => (
            <NavButton key={item.to} item={item} unlocked />
          ))}
        </div>
      </motion.nav>
    </TooltipProvider>
  );
}
