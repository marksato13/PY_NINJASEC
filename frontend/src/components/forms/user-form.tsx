"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createUser, DashboardUser, getMe } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { JOB_TITLE_OPTIONS } from "@/lib/constants";
import { userFormSchema, type UserFormValues } from "@/lib/validation";

type UserFormProps = {
  onCreated: (user: DashboardUser) => void;
};

export function UserForm({ onCreated }: UserFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      role: "collaborator",
      jobTitle: "",
      customJobTitle: "",
    },
  });

  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const jobTitleValue = watch("jobTitle");
  const firstError = useMemo(() => Object.values(errors)[0]?.message, [errors]);

  useEffect(() => {
    getMe()
      .then((me) => setOrganizationId(me.organization_id ?? null))
      .catch(() => setOrganizationId(null));
  }, []);

  async function onSubmit(values: UserFormValues) {
    if (!organizationId) {
      notifyError("No se pudo resolver la organizacion");
      return;
    }

    try {
      const resolvedJobTitle = values.jobTitle === "Otro" ? values.customJobTitle : values.jobTitle;
      const normalizedJobTitle = resolvedJobTitle?.trim() || undefined;
      const created = await createUser({
        organization_id: organizationId,
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        role_code: values.role,
        job_title: normalizedJobTitle,
      });
      onCreated(created);
      reset();
      notifySuccess("Usuario creado", "El usuario ya puede iniciar sesion.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const label = msg.toLowerCase().includes("email") && msg.toLowerCase().includes("exist")
        ? "El correo ya está registrado en el sistema"
        : msg || "Error desconocido";
      notifyError("No se pudo crear el usuario", label);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <input placeholder="Nombre completo" {...register("fullName")} required />
      <input placeholder="Correo" type="email" {...register("email")} required />
      <input placeholder="Contrasena temporal" type="password" {...register("password")} required />
      <select {...register("jobTitle")}>
        <option value="">Selecciona un cargo</option>
        {JOB_TITLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {jobTitleValue === "Otro" ? <input placeholder="Especifica el cargo" {...register("customJobTitle")} /> : null}
      <select {...register("role")}>
        <option value="admin">Admin</option>
        <option value="collaborator">Collaborator</option>
        <option value="client">Client</option>
      </select>
      {firstError ? <p className="form-error">{firstError}</p> : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Crear usuario"}
      </button>
    </form>
  );
}
