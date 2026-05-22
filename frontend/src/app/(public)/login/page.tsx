import { Suspense } from "react";

import { LoginForm } from "@/components/dashboard/login-form";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { Mascot } from "@/components/ui/mascot";

export default function LoginPage() {
  return (
    <PublicPageShell>
      <div className="login-futuristic">
        <div className="login-grid-bg" aria-hidden />
        <div className="login-orb login-orb--blue" aria-hidden />
        <div className="login-orb login-orb--cyan" aria-hidden />

        <div className="login-futuristic-grid">
          {/* Columna mascota — solo desktop */}
          <aside className="login-mascot-pane">
            <div className="login-mascot-stage">
              <div className="login-mascot-rings" aria-hidden>
                <span /><span /><span />
              </div>
              <Mascot variant="hero" size="md" priority float glow={false} />
            </div>
            <div className="login-mascot-id">
              <p className="login-mascot-tag">
                <span className="login-mascot-dot" />
                SYSTEM ONLINE
              </p>
              <h3>KURO <span>v0.2.0</span></h3>
              <p className="login-mascot-bio">
                Asistente táctico de NinjaSec.<br />
                Vigilando la red 24/7.
              </p>
              <div className="login-mascot-stats">
                <div><strong>99.9%</strong><span>uptime</span></div>
                <div><strong>SOC</strong><span>peruano</span></div>
                <div><strong>ISO</strong><span>27001</span></div>
              </div>
            </div>
          </aside>

          {/* Columna formulario */}
          <div className="login-form-pane">
            <div className="login-eyebrow-row">
              <span className="login-eyebrow-pill">
                <span className="login-eyebrow-dot" />
                ACCESO SEGURO
              </span>
              <span className="login-eyebrow-meta">/auth/v1</span>
            </div>
            <h1 className="login-headline">
              Inicia sesión en <span className="login-headline-accent">NinjaSec</span>
            </h1>
            <p className="login-subhead">
              Accedé al dashboard administrativo o al portal según el rol asignado a tu cuenta.
            </p>
            <div className="login-card-cyber">
              <div className="login-card-scan" aria-hidden />
              <Suspense fallback={<div className="state-panel">Cargando…</div>}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
