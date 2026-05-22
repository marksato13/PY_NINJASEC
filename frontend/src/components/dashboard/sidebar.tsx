"use client";

import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileBarChart2,
  FolderKanban,
  Layers,
  LogOut,
  Plug,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Target,
  Ticket,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { clearSession, getStoredUser } from "@/lib/auth";
import { formatRoleLabel, getInitials } from "@/lib/role-utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean; // si true, no visible para collaborator
};
type NavGroup = {
  id: string;
  label: string;
  staffAllowed: boolean; // true = super_admin + admin + collaborator
  items: NavItem[];
};

const IC = (Icon: React.ElementType) => <Icon size={16} strokeWidth={1.75} />;

const navGroups: NavGroup[] = [
  {
    id: "operations",
    label: "Operaciones",
    staffAllowed: true,
    items: [
      { label: "Dashboard",     href: "/dashboard",                   icon: IC(BarChart3),    adminOnly: true },
      { label: "Proyectos",     href: "/dashboard/projects",          icon: IC(FolderKanban) },
      { label: "Integraciones", href: "/dashboard/integrations",      icon: IC(Plug) },
      { label: "Dispositivos",  href: "/dashboard/devices",           icon: IC(Server) },
      { label: "Revisiones",    href: "/dashboard/security-reviews",  icon: IC(ShieldCheck) },
      { label: "Tickets",       href: "/dashboard/support-tickets",   icon: IC(Ticket) },
    ],
  },
  {
    id: "commercial",
    label: "Clientes",
    staffAllowed: true,
    items: [
      { label: "Clientes",      href: "/dashboard/clients",       icon: IC(Building2) },
      { label: "Colaboradores", href: "/dashboard/collaborators", icon: IC(UserCheck) },
      { label: "Leads",         href: "/dashboard/leads",         icon: IC(Target),  adminOnly: true },
      { label: "Servicios",     href: "/dashboard/services",      icon: IC(Layers),  adminOnly: true },
    ],
  },
  {
    id: "talent",
    label: "Talento",
    staffAllowed: false,
    items: [
      { label: "Usuarios",      href: "/dashboard/users",         icon: IC(Users) },
      { label: "Postulaciones", href: "/dashboard/applications",  icon: IC(BriefcaseBusiness) },
    ],
  },
  {
    id: "control",
    label: "Control",
    staffAllowed: false,
    items: [
      { label: "Reportes",      href: "/dashboard/reports",    icon: IC(FileBarChart2) },
      { label: "Aprobaciones",  href: "/dashboard/approvals",  icon: IC(CheckSquare) },
      { label: "Auditoria",     href: "/dashboard/audit",      icon: IC(ScrollText) },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    staffAllowed: false,
    items: [
      { label: "Configuracion", href: "/dashboard/settings", icon: IC(Settings) },
    ],
  },
];

type SidebarProps = {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
};

export function Sidebar({ isOpen = false, isCollapsed = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = getStoredUser();
  const role = user?.role ?? "";

  const isAdmin = role === "super_admin" || role === "admin";
  const isCollaborator = role === "collaborator";
  const isSuperAdmin = role === "super_admin";

  const visibleGroups = navGroups.filter((g) =>
    isAdmin || (isCollaborator && g.staffAllowed)
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    navGroups.reduce((acc, g) => { acc[g.id] = true; return acc; }, {} as Record<string, boolean>),
  );

  function toggleGroup(id: string) {
    setExpandedGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""} ${isCollapsed ? "sidebar--collapsed" : ""}`}>

      {/* Brand */}
      <div className="brand-block sidebar-header">
        <div className="logo-space">NS</div>
        {!isCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>NinjaSec</p>
            <span className="pill" style={{ fontSize: "0.65rem", padding: "2px 7px" }}>
              {formatRoleLabel(role)}
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
        {visibleGroups.map((group) => {
          const isExpanded = isCollapsed ? true : expandedGroups[group.id];

          // Filtrar items: collaborator no ve los adminOnly, admin no ve Auditoria (solo super_admin)
          const items = group.items.filter((item) => {
            if (isCollaborator && item.adminOnly) return false;
            if (item.href === "/dashboard/audit" && !isSuperAdmin) return false;
            return true;
          });

          if (items.length === 0) return null;

          return (
            <div className="sidebar-group" key={group.id}>
              {!isCollapsed && (
                <button
                  className="sidebar-group-header"
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="sidebar-group-title">{group.label}</span>
                  <span className="sidebar-group-toggle">
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>
              )}
              {isExpanded && (
                <div className="sidebar-group-items">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) ? "nav-item-active" : ""}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="nav-item-icon-wrap">{item.icon}</span>
                      {!isCollapsed && <strong>{item.label}</strong>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
            <p className="sidebar-footer-role">{formatRoleLabel(role)}</p>
          </div>
          <button
            className="sidebar-footer-btn"
            type="button"
            onClick={handleLogout}
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
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
            title="Cerrar sesion"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
