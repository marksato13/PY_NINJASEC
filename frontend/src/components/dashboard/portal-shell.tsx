"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Package, Server, ShieldCheck, Ticket } from "lucide-react";

import {
  AuthUser,
  getClients,
  getClientServices,
  getDevices,
  getMe,
  getProjectDocs,
  getSupportTickets,
} from "@/lib/api";
import { clearSession, getStoredToken, isPortalRole, isTokenExpired } from "@/lib/auth";

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PortalShell() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeDevices, setActiveDevices] = useState(0);
  const [docsCount, setDocsCount] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [servicesCount, setServicesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (isTokenExpired(token)) {
      clearSession();
      window.location.href = "/login?expired=1";
      return;
    }

    async function loadPortal() {
      try {
        const me = await getMe();
        if (!isPortalRole(me.role)) {
          window.location.href = "/dashboard";
          return;
        }
        setUser(me);

        const [devicesRes, docsRes, ticketsRes, clientsRes] = await Promise.allSettled([
          getDevices({}),
          getProjectDocs(),
          getSupportTickets({ ticket_status: "open" }),
          getClients(),
        ]);
        if (devicesRes.status === "fulfilled")
          setActiveDevices(devicesRes.value.filter((d) => d.status === "active").length);
        if (docsRes.status === "fulfilled") setDocsCount(docsRes.value.length);
        if (ticketsRes.status === "fulfilled") setOpenTickets(ticketsRes.value.length);
        // P-03: contar servicios contratados (ClientService) del cliente actual
        if (clientsRes.status === "fulfilled" && clientsRes.value.length > 0) {
          try {
            const myServices = await getClientServices(clientsRes.value[0].id);
            const now = Date.now();
            const active = myServices.filter((cs) => {
              if (cs.ends_at && new Date(cs.ends_at).getTime() < now) return false;
              return true;
            });
            setServicesCount(active.length);
          } catch {
            setServicesCount(0);
          }
        }
      } catch (err) {
        clearSession();
        setError(err instanceof Error ? err.message : "No se pudo cargar el portal");
      } finally {
        setLoading(false);
      }
    }

    loadPortal();
  }, []);

  if (loading) return <div className="state-panel">Cargando portal...</div>;
  if (error)   return <div className="state-panel state-error">{error}</div>;

  return (
    <section className="page-stack">

      {/* Hero welcome */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">{roleLabel(user?.role ?? "")}</p>
          <h2>Bienvenido, {user?.name || user?.full_name}</h2>
        </div>
        {user?.job_title && (
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{user.job_title}</span>
        )}
      </div>

      {/* KPI grid */}
      <div className="metrics-grid">
        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Ticket size={16} style={{ color: openTickets > 0 ? "var(--warning)" : "var(--success)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Tickets abiertos</span>
          </div>
          <strong style={{ fontSize: "2rem", color: openTickets === 0 ? "var(--success)" : openTickets <= 3 ? "var(--warning)" : "var(--danger)" }}>
            {openTickets}
          </strong>
          <Link href="/portal/tickets" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>Ver tickets →</Link>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Server size={16} style={{ color: "var(--success)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Dispositivos activos</span>
          </div>
          <strong style={{ fontSize: "2rem", color: activeDevices > 0 ? "var(--success)" : "var(--muted)" }}>
            {activeDevices}
          </strong>
          <Link href="/portal/inventory" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>Ver inventario →</Link>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Documentos disponibles</span>
          </div>
          <strong style={{ fontSize: "2rem", color: docsCount > 0 ? "var(--success)" : "var(--muted)" }}>
            {docsCount}
          </strong>
          <Link href="/portal/documents" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>Ver documentos →</Link>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} style={{ color: openTickets > 0 ? "var(--warning)" : "var(--success)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Estado seguridad</span>
          </div>
          <strong style={{ fontSize: "2rem", color: openTickets === 0 ? "var(--success)" : "var(--warning)" }}>
            {openTickets === 0 ? "OK" : "⚠"}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            {openTickets === 0 ? "Sin incidencias abiertas" : `${openTickets} pendiente${openTickets !== 1 ? "s" : ""}`}
          </span>
        </article>
      </div>

      {/* Quick access grid */}
      <div className="split-grid">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Acceso rápido</p><h3>Módulos disponibles</h3></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link className="button button-secondary" href="/portal/inventory" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Server size={16} /> Inventario de activos
            </Link>
            <Link className="button button-secondary" href="/portal/documents" style={{ justifyContent: "flex-start", gap: 10 }}>
              <FileText size={16} /> Documentos
            </Link>
            <Link className="button button-secondary" href="/portal/tickets" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Ticket size={16} /> Tickets de soporte
            </Link>
            <Link className="button button-secondary" href="/portal/services" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Package size={16} /> Servicios contratados ({servicesCount})
            </Link>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Sesión</p><h3>Datos de acceso</h3></div>
          </div>
          <ul className="stack-list">
            <li><strong>Nombre:</strong> {user?.name || user?.full_name}</li>
            <li><strong>Email:</strong> {user?.email}</li>
            <li><strong>Rol:</strong> {user ? roleLabel(user.role) : "-"}</li>
            <li><strong>Cargo:</strong> {user?.job_title || "Sin cargo"}</li>
          </ul>
        </article>
      </div>

    </section>
  );
}
