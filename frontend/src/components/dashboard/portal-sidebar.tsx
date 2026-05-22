"use client";

import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Package,
  Server,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearSession, getStoredUser } from "@/lib/auth";
import { formatRoleLabel, getInitials } from "@/lib/role-utils";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const IC = (Icon: React.ElementType) => <Icon size={16} strokeWidth={1.75} />;

const clientNavItems: NavItem[] = [
  { label: "Inicio",     href: "/portal",           icon: IC(LayoutGrid) },
  { label: "Inventario", href: "/portal/inventory", icon: IC(Server) },
  { label: "Documentos", href: "/portal/documents", icon: IC(FileText) },
  { label: "Tickets",    href: "/portal/tickets",   icon: IC(HelpCircle) },
  { label: "Servicios",  href: "/portal/services",  icon: IC(Package) },
  { label: "Perfil",     href: "/portal/profile",   icon: IC(User) },
];

const baseItems: NavItem[] = [
  { label: "Portal",    href: "/portal",          icon: IC(LayoutGrid) },
  { label: "Perfil",    href: "/portal/profile",  icon: IC(User) },
];

const collaboratorItems: NavItem[] = [
  { label: "Postulaciones", href: "/portal/applications", icon: IC(ClipboardList) },
  { label: "Tareas",        href: "/portal/tasks",        icon: IC(CheckSquare) },
  { label: "Recursos",      href: "/portal/resources",    icon: IC(BookOpen) },
];

function getNavItems(role?: string | null) {
  if (role === "client")       return clientNavItems;
  if (role === "collaborator") return [...baseItems, ...collaboratorItems];
  return baseItems;
}

type PortalSidebarProps = {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
};

export function PortalSidebar({ isOpen = false, isCollapsed = false, onClose }: PortalSidebarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = getStoredUser();
  const navItems = getNavItems(user?.role);

  function handleLogout() {
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={`sidebar portal-sidebar ${isOpen ? "sidebar--open" : ""} ${isCollapsed ? "sidebar--collapsed" : ""}`}>

      {/* Brand */}
      <div className="brand-block sidebar-header">
        <div className="logo-space">NS</div>
        {!isCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>NinjaSec</p>
            <span className="pill" style={{ fontSize: "0.65rem", padding: "2px 7px" }}>
              {formatRoleLabel(user?.role ?? "portal")}
            </span>
          </div>
        )}
        <button
          className="sidebar-close button button-ghost button-icon"
          type="button"
          aria-label="Cerrar menu"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-group">
          <div className="sidebar-group-items">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href)) ? "nav-item-active" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="nav-item-icon-wrap">{item.icon}</span>
                {!isCollapsed && <strong>{item.label}</strong>}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && user && (
        <div className="sidebar-footer">
          <div
            className="profile-avatar"
            style={{
              background: `hsl(${(user.name?.charCodeAt(0) ?? 200) % 360}, 55%, 42%)`,
              flexShrink: 0,
            }}
          >
            {getInitials(user.name)}
          </div>
          <div className="sidebar-footer-info">
            <p className="sidebar-footer-name">{user.name}</p>
            <p className="sidebar-footer-role">{formatRoleLabel(user.role)}</p>
          </div>
          <button
            className="sidebar-footer-btn"
            type="button"
            onClick={handleLogout}
            title="Cerrar sesion"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
      {isCollapsed && (
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--line)", marginTop: "auto" }}>
          <button
            className="sidebar-footer-btn"
            style={{ width: "100%" }}
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
