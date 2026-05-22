import { PublicPageShell } from "@/components/public/public-page-shell";

export default function NosotrosPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Nosotros</p>
        <h1>NinjaSec combina producto, servicios y ejecución técnica.</h1>
        <p>
          Nuestra misión es convertir datos de infraestructura y seguridad en información accionable,
          mientras ayudamos a organizaciones a automatizar visibilidad, reportes y decisiones.
        </p>
      </section>

      <section className="marketing-grid marketing-grid--two">
        <article className="panel">
          <h3>Misión</h3>
          <p>Automatizar reporting e integraciones API para que empresas y MSPs operen con claridad y menor fricción.</p>
        </article>
        <article className="panel">
          <h3>Visión</h3>
          <p>Ser una plataforma y firma tecnológica reconocida por conectar infraestructura, seguridad y negocio en un solo ecosistema.</p>
        </article>
        <article className="panel panel-wide">
          <h3>Enfoque</h3>
          <p>
            Construimos soluciones serias para APIs, dashboards, reportes automatizados y operación técnica,
            manteniendo como núcleo el reporting desde dispositivos conectados y servicios de valor agregado.
          </p>
        </article>
      </section>
    </PublicPageShell>
  );
}
