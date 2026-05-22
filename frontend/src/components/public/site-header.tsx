"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/servicios", label: "Servicios" },
  { href: "/solucion", label: "Solucion" },
  { href: "/contacto", label: "Contacto" },
  { href: "/agenda-demo", label: "Agenda Demo" },
  { href: "/colabora", label: "Colabora" },
  { href: "/login", label: "Login" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand-mark" href="/">
          <span className="brand-mark__logo">NS</span>
          <span>
            <strong>NinjaSec</strong>
            <small>API Reporting Platform</small>
          </span>
        </Link>

        <nav className="site-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`site-nav__link ${pathname === link.href ? "site-nav__link--active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
