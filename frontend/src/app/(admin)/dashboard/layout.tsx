"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { DashboardGuard } from "@/components/dashboard/dashboard-guard";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getMe } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topbarUser, setTopbarUser] = useState<{ name: string; role: string; email: string } | null>(null);

  useEffect(() => {
    if (!getStoredToken()) return;
    getMe()
      .then((me) =>
        setTopbarUser({
          name: me.name || me.full_name || me.email,
          role: me.role,
          email: me.email,
        }),
      )
      .catch(() => setTopbarUser(null));
  }, []);

  function handleMenuClick() {
    if (typeof window !== "undefined" && window.innerWidth <= 1180) {
      setSidebarOpen(true);
      return;
    }
    setSidebarCollapsed((current) => !current);
  }

  return (
    <DashboardGuard>
      <main className={`admin-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
        />
        <div className={`sidebar-overlay ${sidebarOpen ? "sidebar-overlay--visible" : ""}`} onClick={() => setSidebarOpen(false)} />
        <section className="workspace">
          <Topbar user={topbarUser} onMenuClick={handleMenuClick} />
          <div className="workspace-content">
            {children}
          </div>
        </section>
      </main>
    </DashboardGuard>
  );
}
