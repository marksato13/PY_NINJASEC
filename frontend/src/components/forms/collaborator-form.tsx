"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CollaboratorProfile, createCollaborator } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { collaboratorFormSchema, type CollaboratorFormValues } from "@/lib/validation";

type CollaboratorFormProps = {
  onCreated: (profile: CollaboratorProfile) => void;
};

export function CollaboratorForm({ onCreated }: CollaboratorFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CollaboratorFormValues>({
    resolver: zodResolver(collaboratorFormSchema),
    defaultValues: {
      userId: "",
      positionTitle: "",
      seniority: "",
      availability: "",
    },
  });

  const firstError = useMemo(() => Object.values(errors)[0]?.message, [errors]);

  async function onSubmit(values: CollaboratorFormValues) {
    try {
      const created = await createCollaborator({
        user_id: Number(values.userId),
        position_title: values.positionTitle?.trim() || undefined,
        seniority: values.seniority?.trim() || undefined,
        availability_status: values.availability?.trim() || undefined,
      });
      onCreated(created);
      reset();
      notifySuccess("Colaborador creado", "El perfil fue registrado.");
    } catch (err) {
      notifyError("No se pudo crear el perfil", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <input placeholder="User ID" type="number" {...register("userId")} required />
      <input placeholder="Cargo" {...register("positionTitle")} />
      <input placeholder="Senioridad" {...register("seniority")} />
      <input placeholder="Disponibilidad" {...register("availability")} />
      {firstError ? <p className="form-error">{firstError}</p> : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Crear colaborador"}
      </button>
    </form>
  );
}
