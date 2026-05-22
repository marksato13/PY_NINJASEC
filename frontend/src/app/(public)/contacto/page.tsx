import { LeadForm } from "@/components/public/lead-form";
import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ContactoPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Contacto</p>
        <h1>Conversemos sobre tu necesidad.</h1>
        <p>Usa este canal para consultas generales, propuestas o coordinación inicial.</p>
      </section>
      <LeadForm title="Contacto comercial" endpoint="leads/" submitLabel="Enviar mensaje" payloadType="contact" />
    </PublicPageShell>
  );
}
