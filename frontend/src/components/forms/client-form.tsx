"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient, DashboardClient, getMe } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { clientFormSchema, type ClientFormValues } from "@/lib/validation";

type ClientFormProps = {
  onCreated: (client: DashboardClient) => void;
};

export function ClientForm({ onCreated }: ClientFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactEmail: "",
      sector: "",
      city: "",
      country: "",
      status: "prospect",
    },
  });

  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const firstError = useMemo(() => Object.values(errors)[0]?.message, [errors]);

  useEffect(() => {
    getMe()
      .then((me) => setOrganizationId(me.organization_id ?? null))
      .catch(() => setOrganizationId(null));
  }, []);

  async function onSubmit(values: ClientFormValues) {
    if (!organizationId) {
      notifyError("No se pudo resolver la organizacion");
      return;
    }

    try {
      const created = await createClient({
        organization_id: organizationId,
        company_name: values.companyName,
        sector: values.sector?.trim() || undefined,
        commercial_status: values.status,
        city: values.city?.trim() || undefined,
        country: values.country?.trim() || undefined,
        size: values.contactName?.trim() || undefined,
        notes: values.contactEmail?.trim() || undefined,
      });
      onCreated(created);
      reset();
      notifySuccess("Cliente creado", "El cliente fue registrado correctamente.");
    } catch (err) {
      notifyError("No se pudo crear el cliente", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <input placeholder="Empresa" {...register("companyName")} required />
      <input placeholder="Contacto" {...register("contactName")} />
      <input placeholder="Correo de contacto" type="email" {...register("contactEmail")} />
      <input placeholder="Sector" {...register("sector")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input placeholder="Ciudad" {...register("city")} />
        <input placeholder="País" {...register("country")} />
      </div>
      <select {...register("status")}>
        <option value="prospect">Prospect</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
      </select>
      {firstError ? <p className="form-error">{firstError}</p> : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Crear cliente"}
      </button>
    </form>
  );
}
