"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { getMe } from "@/lib/api";
import { clearSession, getStoredToken, isTokenExpired } from "@/lib/auth";

const DASHBOARD_ROLES = ["super_admin", "admin", "collaborator"];

export function DashboardGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("Validando sesion...");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired(token)) {
      clearSession();
      router.replace("/login?expired=1");
      return;
    }

    async function validate() {
      try {
        const me = await getMe();
        if (me.role === "client") {
          router.replace("/portal");
          return;
        }
        if (!DASHBOARD_ROLES.includes(me.role)) {
          clearSession();
          router.replace("/login");
          return;
        }
        setAllowed(true);
      } catch {
        clearSession();
        setMessage("Sesion invalida. Redirigiendo...");
        router.replace("/login");
      }
    }

    validate();
  }, [router]);

  if (!allowed) {
    return <div className="state-panel">{message}</div>;
  }

  return <>{children}</>;
}
