import { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell">
      <SiteHeader />
      <main className="marketing-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
