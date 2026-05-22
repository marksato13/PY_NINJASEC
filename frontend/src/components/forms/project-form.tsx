"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createProject,
  DashboardClient,
  getClients,
  getMe,
  getProducts,
  getProjectTypes,
  getServices,
  ProductItem,
  ProjectItem,
  ProjectTypeItem,
  ServiceItem,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validation";

type ProjectFormProps = {
  onCreated: (project: ProjectItem) => void;
};

const statusOptions = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

export function ProjectForm({ onCreated }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      clientId: "",
      projectTypeId: "",
      serviceId: "",
      productId: "",
      description: "",
      status: "planning",
      startDate: "",
      endDate: "",
    },
  });

  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const firstError = useMemo(() => Object.values(errors)[0]?.message, [errors]);

  useEffect(() => {
    Promise.all([getMe(), getClients(), getProjectTypes(), getServices(), getProducts()])
      .then(([me, clientsData, typesData, servicesData, productsData]) => {
        setOrganizationId(me.organization_id ?? null);
        setClients(clientsData);
        setProjectTypes(typesData);
        setServices(servicesData.filter((item) => item.active));
        setProducts(productsData.filter((item) => item.is_active));
      })
      .catch(() => setOrganizationId(null));
  }, []);

  async function onSubmit(values: ProjectFormValues) {
    if (!organizationId) {
      notifyError("No se pudo resolver la organizacion");
      return;
    }

    const parsedClientId = Number(values.clientId);
    const parsedProjectTypeId = Number(values.projectTypeId);
    const parsedServiceId = values.serviceId ? Number(values.serviceId) : null;
    const parsedProductId = values.productId ? Number(values.productId) : null;

    try {
      const created = await createProject({
        organization_id: organizationId,
        client_id: parsedClientId,
        project_type_id: parsedProjectTypeId,
        service_id: parsedServiceId,
        product_id: parsedProductId,
        name: values.name,
        description: values.description?.trim() || undefined,
        status: values.status,
        start_date: values.startDate || null,
        end_date: values.endDate || null,
      });
      onCreated(created);
      reset();
      notifySuccess("Proyecto creado", "El proyecto fue agregado al pipeline.");
    } catch (err) {
      notifyError("No se pudo crear el proyecto", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <input placeholder="Nombre" {...register("name")} required />
      <select {...register("clientId")} required>
        <option value="">Selecciona un cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.company_name}
          </option>
        ))}
      </select>
      <select {...register("projectTypeId")} required>
        <option value="">Selecciona tipo de proyecto</option>
        {projectTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
      <select {...register("serviceId")}>
        <option value="">Selecciona un servicio (opcional)</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.title}
          </option>
        ))}
      </select>
      <select {...register("productId")}>
        <option value="">Selecciona un producto (opcional)</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      <textarea placeholder="Descripcion" {...register("description")} rows={4} />
      <select {...register("status")}>
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="table-row table-row-wide">
        <input type="date" {...register("startDate")} />
        <input type="date" {...register("endDate")} />
      </div>
      {firstError ? <p className="form-error">{firstError}</p> : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Crear proyecto"}
      </button>
    </form>
  );
}
