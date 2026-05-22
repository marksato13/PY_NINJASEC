import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <h3>NinjaSec</h3>
          <p>
            Plataforma y firma tecnológica orientada a integraciones API, reporting automatizado,
            dashboards y servicios especializados para infraestructura y ciberseguridad.
          </p>
        </div>

        <div>
          <h4>Enlaces</h4>
          <ul>
            <li><Link href="/servicios">Servicios</Link></li>
            <li><Link href="/solucion">Solucion</Link></li>
            <li><Link href="/agenda-demo">Agenda Demo</Link></li>
            <li><Link href="/colabora">Colabora</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
