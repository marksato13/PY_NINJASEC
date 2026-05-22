import { PublicPageShell } from "@/components/public/public-page-shell";
import { ServiceRequestForm } from "@/components/public/service-request-form";

const services = [
  ["Integración API", "Conectamos dispositivos, plataformas y sistemas para centralizar datos."],
  ["Reporting automatizado", "Generamos reportes técnicos y ejecutivos listos para cliente o gerencia."],
  ["Dashboards operativos", "Creamos paneles para operación, monitoreo y toma de decisiones."],
  ["Sistemas a medida", "Desarrollamos soluciones internas, MVPs y plataformas modulares."],
];

export default function ServiciosPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Servicios</p>
        <h1>Servicios tecnológicos con foco en reporting, automatización e integración.</h1>
        <p>
          NinjaSec combina producto principal y servicios especializados para empresas, áreas TI,
          consultoras y MSPs que buscan visibilidad y automatización real.
        </p>
      </section>

      <section className="marketing-grid marketing-grid--two">
        {services.map(([title, description]) => (
          <article className="panel" key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="content-hero">
        <p className="eyebrow">Solicitudes</p>
        <h2>Conversemos sobre tu necesidad.</h2>
        <p>
          Usa este formulario para solicitar un servicio o iniciar una conversacion tecnica.
          Respondemos con un plan de trabajo y la mejor ruta para tu caso.
        </p>
      </section>

      <ServiceRequestForm />
    </PublicPageShell>
  );
}
