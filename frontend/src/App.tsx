import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import Audience from "@/pages/Audience";
import Segments from "@/pages/Segments";
import CreativeReview from "@/pages/CreativeReview";
import EmailReview from "@/pages/EmailReview";
import ApprovalQueue from "@/pages/ApprovalQueue";
import Settings from "@/pages/Settings";
import Logs from "@/pages/Logs";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/audience" replace />} />
        <Route path="/audience" element={<PageTransition><Audience /></PageTransition>} />
        <Route path="/segments" element={<PageTransition><Segments /></PageTransition>} />
        <Route path="/creative" element={<PageTransition><CreativeReview /></PageTransition>} />
        <Route path="/emails" element={<PageTransition><EmailReview /></PageTransition>} />
        <Route path="/approvals" element={<PageTransition><ApprovalQueue /></PageTransition>} />
        <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
        <Route path="/logs" element={<PageTransition><Logs /></PageTransition>} />
        <Route path="*" element={<Navigate to="/audience" replace />} />
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
