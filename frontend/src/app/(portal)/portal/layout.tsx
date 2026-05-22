"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { PortalGuard } from "@/components/dashboard/portal-guard";
import { PortalHeader } from "@/components/dashboard/portal-header";
import { PortalSidebar } from "@/components/dashboard/portal-sidebar";
import { KuroHelper } from "@/components/ui/kuro-helper";

export default function PortalLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useState(false);

  return (
    <PortalGuard>
      <main className={`admin-shell portal-shell-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <PortalSidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
        />
        <div className={`sidebar-overlay ${sidebarOpen ? "sidebar-overlay--visible" : ""}`} onClick={() => setSidebarOpen(false)} />
        <section className="workspace portal-workspace">
          <PortalHeader onToggleSidebar={() => setSidebarOpen(true)} />
          {children}
        </section>
        <KuroHelper />
      </main>
    </PortalGuard>
  );
}
