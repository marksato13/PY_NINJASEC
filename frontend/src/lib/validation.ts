import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido").min(5).max(180),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const userFormSchema = z
  .object({
    fullName: z.string().min(2, "Ingresa el nombre completo"),
    email: z.string().email("Correo invalido"),
    password: z.string().min(6, "Minimo 6 caracteres"),
    role: z.enum(["admin", "collaborator", "client"]),
    jobTitle: z.string().optional(),
    customJobTitle: z.string().optional(),
  })
  .refine((data) => data.jobTitle !== "Otro" || !!data.customJobTitle, {
    path: ["customJobTitle"],
    message: "Especifica el cargo",
  });

export type UserFormValues = z.infer<typeof userFormSchema>;

export const userEditFormSchema = z
  .object({
    fullName: z.string().min(2, "Ingresa el nombre completo"),
    jobTitle: z.string().optional(),
    customJobTitle: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((data) => data.jobTitle !== "Otro" || !!data.customJobTitle, {
    path: ["customJobTitle"],
    message: "Especifica el cargo",
  });

export type UserEditFormValues = z.infer<typeof userEditFormSchema>;

export const clientFormSchema = z.object({
  companyName: z.string().min(2, "Ingresa el nombre de la empresa"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Correo invalido").optional(),
  sector: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["prospect", "active", "paused"]),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const collaboratorFormSchema = z.object({
  userId: z.string().regex(/^\d+$/, "User ID invalido"),
  positionTitle: z.string().optional(),
  seniority: z.string().optional(),
  availability: z.string().optional(),
});

export type CollaboratorFormValues = z.infer<typeof collaboratorFormSchema>;

export const projectFormSchema = z
  .object({
    name: z.string().min(2, "Ingresa el nombre del proyecto"),
    clientId: z.string().min(1, "Selecciona un cliente"),
    projectTypeId: z.string().min(1, "Selecciona un tipo de proyecto"),
    serviceId: z.string().optional(),
    productId: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["planning", "active", "paused", "completed"]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((data) => !!data.serviceId || !!data.productId, {
    path: ["serviceId"],
    message: "Selecciona un servicio o producto",
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const projectEditFormSchema = z.object({
  status: z.enum(["planning", "active", "paused", "completed"]),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProjectEditFormValues = z.infer<typeof projectEditFormSchema>;
