import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Layers,
  Palette,
  Mail,
  ShieldCheck,
  Settings as SettingsIcon,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS: {
  label: string;
  items: { to: string; icon: typeof Users; label: string }[];
}[] = [
  {
    label: "Pipeline",
    items: [
      { to: "/audience", icon: Users, label: "Audience" },
      { to: "/segments", icon: Layers, label: "Segments" },
      { to: "/creative", icon: Palette, label: "Creative Review" },
      { to: "/emails", icon: Mail, label: "Email Review" },
      { to: "/approvals", icon: ShieldCheck, label: "Approval Queue" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/settings", icon: SettingsIcon, label: "Settings" },
      { to: "/logs", icon: ScrollText, label: "Logs" },
    ],
  },
];

export function Sidebar() {
  return (
    <div className="glass-sidebar h-full w-60 shrink-0 flex flex-col py-5 px-3">
      <div className="px-2 mb-6">
        {/*
          mosaic_logo.png is a square lockup with a lot of white margin around
          the mark + wordmark. Rather than ship a second cropped asset, the
          box below crops to the artwork (x 15–85%, y 24–70%) and `multiply`
          drops the near-white ground into the translucent glass sidebar.
        */}
        <div
          className="relative w-full overflow-hidden select-none"
          style={{ aspectRatio: "1.52" }}
        >
          <img
            src="/mosaic_logo.png"
            alt="MOSAIC"
            draggable={false}
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: "142.9%",
              maxWidth: "none",
              transform: "translate(-15%, -24%)",
              mixBlendMode: "multiply",
            }}
          />
        </div>
        <div className="text-[10px] text-sidebar-foreground/50 text-center -mt-1">
          Campaign Console
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35 mb-1.5">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  {({ isActive }) => (
                    <div
                      className={cn(
                        "relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150",
                        isActive
                          ? "text-primary"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 glass-nav-active rounded-xl"
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <item.icon className="h-4 w-4 relative z-10 shrink-0" />
                      <span className="relative z-10 truncate">{item.label}</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
