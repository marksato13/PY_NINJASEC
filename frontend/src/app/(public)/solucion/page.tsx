import { PublicPageShell } from "@/components/public/public-page-shell";

export default function SolucionPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Solucion</p>
        <h1>Como funciona NinjaSec.</h1>
        <p>
          La plataforma conecta dispositivos y sistemas por API, procesa datos y genera dashboards
          y reportes que reducen trabajo manual y elevan la visibilidad operativa.
        </p>
      </section>

      <section className="marketing-grid marketing-grid--three">
        <article className="panel"><h3>1. Conectores</h3><p>Integraciones con pfSense, FortiGate y futuras plataformas.</p></article>
        <article className="panel"><h3>2. Normalización</h3><p>Transformamos datos dispersos en métricas consistentes.</p></article>
        <article className="panel"><h3>3. Reportes</h3><p>Entregamos resultados técnicos y ejecutivos listos para usar.</p></article>
      </section>
    </PublicPageShell>
  );
}
