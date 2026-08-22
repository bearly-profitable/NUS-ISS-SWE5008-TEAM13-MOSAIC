import { useEffect, useRef, type ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { NAV_ITEMS, isUnlocked } from "@/lib/pipeline";
import CompanyInfo from "@/pages/CompanyInfo";
import Segments from "@/pages/Segments";
import CreativeReview from "@/pages/CreativeReview";
import EmailReview from "@/pages/EmailReview";
import ApprovalQueue from "@/pages/ApprovalQueue";
import Settings from "@/pages/Settings";
import Logs from "@/pages/Logs";

/**
 * Keeps a pasted or bookmarked URL honest: a stage the operator hasn't
 * unlocked yet sends them back to step 1 rather than rendering a page whose
 * only content is "do the previous step first". Same rule the floating nav
 * greys out with — see lib/pipeline.ts.
 */
function Gated({ path, children }: { path: string; children: ReactNode }) {
  const { state, loading } = useWorkspace();
  const item = NAV_ITEMS.find((i) => i.to === path);

  // Nothing to check against until the first fetch lands; the shell already
  // shows a loading state, and redirecting early would bounce a legitimate
  // deep link on every refresh.
  if (loading) return null;
  if (item && !isUnlocked(item, state)) return <Navigate to="/company" replace />;
  return <>{children}</>;
}

const ORDER = NAV_ITEMS.map((item) => item.to);

/**
 * Which way the operator just moved through the pipeline: +1 forward, -1 back.
 *
 * Anything off the map (a redirect, an unknown path) counts as forward, which
 * is the direction the console is almost always travelling in.
 */
function useNavDirection(pathname: string): number {
  const index = ORDER.indexOf(pathname);
  const previous = useRef(index);

  const direction = index < 0 || previous.current < 0 ? 1 : Math.sign(index - previous.current) || 1;
  useEffect(() => {
    previous.current = index;
  }, [index]);

  return direction;
}

function AnimatedRoutes() {
  const location = useLocation();
  const direction = useNavDirection(location.pathname);

  const page = (path: string, element: ReactNode) => (
    <Gated path={path}>
      <PageTransition direction={direction}>{element}</PageTransition>
    </Gated>
  );

  return (
    // `custom` is what carries the direction to the page that is leaving.
    <AnimatePresence mode="wait" custom={direction}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/company" replace />} />
        {/* The first tab was /audience before the overhaul — keep old links working. */}
        <Route path="/audience" element={<Navigate to="/company" replace />} />
        <Route path="/company" element={page("/company", <CompanyInfo />)} />
        <Route path="/segments" element={page("/segments", <Segments />)} />
        <Route path="/creative" element={page("/creative", <CreativeReview />)} />
        <Route path="/emails" element={page("/emails", <EmailReview />)} />
        <Route path="/approvals" element={page("/approvals", <ApprovalQueue />)} />
        <Route path="/settings" element={page("/settings", <Settings />)} />
        <Route path="/logs" element={page("/logs", <Logs />)} />
        <Route path="*" element={<Navigate to="/company" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <div className="gradient-mesh min-h-screen w-full flex items-center justify-center p-6">
        <div className="app-shell">
          <AppShell>
            <AnimatedRoutes />
          </AppShell>
        </div>
      </div>
      <Toaster />
    </WorkspaceProvider>
  );
}
