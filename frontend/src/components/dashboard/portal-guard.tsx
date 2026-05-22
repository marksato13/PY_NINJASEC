"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { getMe } from "@/lib/api";
import { clearSession, getStoredToken, isPortalRole } from "@/lib/auth";

export function PortalGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("Validando sesion...");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    async function validate() {
      try {
        const me = await getMe();
        if (!isPortalRole(me.role)) {
          router.replace("/dashboard");
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
