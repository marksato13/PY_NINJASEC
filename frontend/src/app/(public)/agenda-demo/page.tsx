import { LeadForm } from "@/components/public/lead-form";
import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AgendaDemoPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Agenda Demo</p>
        <h1>Solicita una demo de NinjaSec.</h1>
        <p>Registra tu interés para evaluar cómo integrar reporting automatizado en tu entorno.</p>
      </section>
      <LeadForm title="Agenda una demo" endpoint="leads/" submitLabel="Solicitar demo" payloadType="lead" />
    </PublicPageShell>
  );
}
