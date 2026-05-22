"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";

import { login } from "@/lib/api";
import { persistSession } from "@/lib/auth";
import { loginSchema, type LoginFormValues } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";
  const [apiError, setApiError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setApiError("");
    try {
      const response = await login(values.email, values.password);
      persistSession(response.access_token, response.user);
      router.replace(response.redirect_to);
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {sessionExpired && !apiError ? (
        <p className="form-error" style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", padding: "8px 12px", borderRadius: 6 }}>
          Tu sesión expiró. Por favor, inicia sesión nuevamente.
        </p>
      ) : null}
      <label>
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          placeholder="usuario@empresa.com"
          {...register("email")}
        />
        {errors.email && <p className="form-error">{errors.email.message}</p>}
      </label>

      <label>
        <span>Contraseña</span>
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ paddingRight: "44px" }}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: "0.8rem",
              padding: "0",
            }}
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? "ocultar" : "ver"}
          </button>
        </div>
        {errors.password && <p className="form-error">{errors.password.message}</p>}
      </label>

      {apiError && <p className="form-error">{apiError}</p>}

      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
