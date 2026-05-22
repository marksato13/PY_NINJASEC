"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, HelpCircle, LifeBuoy, Package, Mail, ShieldCheck, Ticket, User, X } from "lucide-react";

import { Mascot } from "@/components/ui/mascot";

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  href: string;
  description: string;
};

const PORTAL_ACTIONS: QuickAction[] = [
  {
    icon: <Ticket size={18} />,
    label: "Crear ticket de soporte",
    href: "/portal/support",
    description: "Reportar un problema o solicitar ayuda técnica",
  },
  {
    icon: <Package size={18} />,
    label: "Ver mis dispositivos",
    href: "/portal/inventory",
    description: "Inventario de equipos monitoreados",
  },
  {
    icon: <ShieldCheck size={18} />,
    label: "Mis revisiones de seguridad",
    href: "/portal/reviews",
    description: "Hallazgos y reportes ejecutivos",
  },
  {
    icon: <FileText size={18} />,
    label: "Mis documentos",
    href: "/portal/documents",
    description: "Manuales, runbooks y contratos",
  },
  {
    icon: <User size={18} />,
    label: "Mi perfil",
    href: "/portal/profile",
    description: "Cambiar contraseña o datos de contacto",
  },
  {
    icon: <Mail size={18} />,
    label: "Contactar a NinjaSec",
    href: "/contacto",
    description: "Hablá con un especialista",
  },
];

export function KuroHelper() {
  const [open, setOpen] = useState(false);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Backdrop sutil para cerrar al click fuera */}
      {open && <div className="kuro-backdrop" onClick={() => setOpen(false)} aria-hidden />}

      {/* Panel deslizable */}
      <aside
        className={`kuro-panel ${open ? "kuro-panel--open" : ""}`}
        role="dialog"
        aria-label="Asistente Kuro"
        aria-hidden={!open}
      >
        <header className="kuro-panel-head">
          <div className="kuro-panel-avatar">
            <Mascot variant="avatar" size="sm" float={false} glow={false} />
          </div>
          <div className="kuro-panel-titles">
            <strong>Kuro</strong>
            <span>¿En qué te ayudo hoy?</span>
          </div>
          <button
            type="button"
            className="kuro-panel-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="kuro-panel-body">
          <p className="kuro-panel-greet">
            <HelpCircle size={14} /> Atajos rápidos para gestionar tu servicio:
          </p>
          <nav className="kuro-actions">
            {PORTAL_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="kuro-action"
                onClick={() => setOpen(false)}
              >
                <span className="kuro-action-icon">{a.icon}</span>
                <span className="kuro-action-text">
                  <strong>{a.label}</strong>
                  <small>{a.description}</small>
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <footer className="kuro-panel-foot">
          <LifeBuoy size={14} />
          <span>Necesitás algo más? Tu ejecutivo de cuenta puede ayudarte.</span>
        </footer>
      </aside>

      {/* FAB */}
      <button
        type="button"
        className={`kuro-fab ${open ? "kuro-fab--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente Kuro" : "Abrir asistente Kuro"}
        aria-expanded={open}
      >
        <span className="kuro-fab-glow" />
        <span className="kuro-fab-img">
          <Mascot variant="avatar" size="sm" float={!open} glow={false} />
        </span>
        {!open && <span className="kuro-fab-pulse" aria-hidden />}
        {!open && <span className="kuro-fab-tooltip">¡Hola! Soy Kuro 🦝</span>}
      </button>
    </>
  );
}
