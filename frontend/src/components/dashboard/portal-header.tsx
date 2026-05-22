"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getSessionDisplayName, getStoredUser } from "@/lib/auth";

const titles: Record<string, string> = {
  "/portal": "Portal",
  "/portal/profile": "Perfil",
  "/portal/projects": "Proyectos",
  "/portal/reports": "Reportes",
  "/portal/support": "Soporte",
  "/portal/company": "Empresa",
  "/portal/inventory": "Inventario",
  "/portal/tickets": "Tickets",
  "/portal/reviews": "Revisiones",
  "/portal/tasks": "Tareas",
  "/portal/resources": "Recursos",
  "/portal/documents": "Documentos",
};

function getInitials(name?: string | null) {
  if (!name) return "NS";
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "NS";
}

export function PortalHeader({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const pathname = usePathname();
  const user = getStoredUser();
  const title = titles[pathname] || "Portal";

  return (
    <header className="portal-header">
      <div className="portal-header__title">
        <span className="eyebrow">Portal</span>
        <h2>{title}</h2>
      </div>

      <div className="portal-header__actions">
        {onToggleSidebar ? (
          <button className="sidebar-toggle" type="button" aria-label="Abrir menu" onClick={onToggleSidebar}>
            <span />
            <span />
            <span />
          </button>
        ) : null}
        <ThemeToggle />
        <Link className="button button-ghost profile-chip" href="/portal/profile">
          <span className="profile-avatar">{getInitials(user?.name || user?.email)}</span>
          <span className="profile-label">{getSessionDisplayName()}</span>
        </Link>
      </div>
    </header>
  );
}
