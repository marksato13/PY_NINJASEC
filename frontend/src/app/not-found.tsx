import Link from "next/link";

import { Mascot } from "@/components/ui/mascot";

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <div className="not-found-card">
        <Mascot variant="confused" size="lg" priority />
        <div className="not-found-content">
          <p className="eyebrow">Error 404</p>
          <h1>Kuro no encuentra esta ruta</h1>
          <p>
            La página que buscás no existe o fue movida. Volvé al inicio o
            agendá una demo si necesitás ayuda.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/">Volver al inicio</Link>
            <Link className="button button-ghost" href="/contacto">Contactar soporte</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
