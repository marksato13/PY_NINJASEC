import { FileBarChart2, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getInitials } from "@/lib/role-utils";

type TopbarProps = {
  user: { name: string; role: string; email: string } | null;
  onMenuClick?: () => void;
};

const topbarTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":                    { title: "Dashboard",             subtitle: "Indicadores y seguimiento operativo" },
  "/dashboard/clients":            { title: "Clientes",              subtitle: "Empresas, sedes y servicios" },
  "/dashboard/integrations":       { title: "Integraciones",         subtitle: "Conectores, licencias y salud" },
  "/dashboard/devices":            { title: "Dispositivos",          subtitle: "Activos monitoreados por consola" },
  "/dashboard/security-reviews":   { title: "Revisiones",            subtitle: "Checklist, hallazgos y cierres" },
  "/dashboard/support-tickets":    { title: "Tickets",               subtitle: "SLA, asignaciones y resolución" },
  "/dashboard/reports":            { title: "Reportes",              subtitle: "Exportes y consolidados" },
  "/dashboard/leads":              { title: "Leads",                 subtitle: "Captación y seguimiento comercial" },
  "/dashboard/services":           { title: "Servicios",             subtitle: "Catálogo de servicios activos" },
  "/dashboard/projects":           { title: "Proyectos",             subtitle: "Pipeline y estado de proyectos" },
  "/dashboard/users":              { title: "Usuarios",              subtitle: "Cuentas y roles del sistema" },
  "/dashboard/collaborators":      { title: "Colaboradores",         subtitle: "Perfiles y disponibilidad" },
  "/dashboard/applications":       { title: "Postulaciones",         subtitle: "Proceso de selección" },
  "/dashboard/approvals":          { title: "Aprobaciones",          subtitle: "Skills y certificaciones pendientes" },
  "/dashboard/audit":              { title: "Auditoria",             subtitle: "Trazabilidad de acciones" },
  "/dashboard/settings":           { title: "Configuración",         subtitle: "Ajustes del sistema" },
};

function resolveTitle(pathname: string) {
  if (topbarTitles[pathname]) return topbarTitles[pathname];
  const match = Object.entries(topbarTitles).find(([path]) => pathname.startsWith(`${path}/`));
  return match?.[1] ?? { title: "Backoffice", subtitle: "Operación centralizada" };
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const copy = resolveTitle(pathname);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="sidebar-toggle topbar-menu"
          type="button"
          aria-label="Colapsar menu"
          onClick={onMenuClick}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="topbar__title">
          <h2>{copy.title}</h2>
          <span className="topbar__subtitle">{copy.subtitle}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <ThemeToggle />
        {user && (
          <div className="user-chip">
            <span
              className="profile-avatar"
              style={{ background: `hsl(${(user.name?.charCodeAt(0) ?? 200) % 360}, 50%, 40%)` }}
            >
              {getInitials(user.name || user.email)}
            </span>
            <span className="profile-label">{user.name}</span>
          </div>
        )}
        <Link className="button button-secondary" href="/dashboard/reports" style={{ gap: 6 }}>
          <FileBarChart2 size={14} />
          Reportes
        </Link>
        <Link className="button button-primary" href="/dashboard/users" style={{ gap: 6 }}>
          <UserPlus size={14} />
          Nuevo usuario
        </Link>
      </div>
    </header>
  );
}
