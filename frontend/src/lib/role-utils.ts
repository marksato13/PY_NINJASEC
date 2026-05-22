export function formatRoleLabel(role: string) {
  const normalized = role?.toLowerCase?.() ?? "";
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    collaborator: "Colaborador",
    client: "Cliente",
  };
  return map[normalized] ?? role.replaceAll("_", " ");
}

export function getAccessLabel(role: string) {
  const normalized = role?.toLowerCase?.() ?? "";
  const map: Record<string, string> = {
    super_admin: "Control total",
    admin: "Administracion",
    collaborator: "Operacion",
    client: "Cliente",
  };
  return map[normalized] ?? "Personalizado";
}

export function getRoleBadgeClass(role: string) {
  const normalized = role?.toLowerCase?.() ?? "";
  const map: Record<string, string> = {
    super_admin: "badge-role-super-admin",
    admin: "badge-role-admin",
    collaborator: "badge-role-collaborator",
    client: "badge-role-client",
  };
  return map[normalized] ?? "badge-role-default";
}

export function formatClientStatus(status: string) {
  const normalized = status?.toLowerCase?.() ?? "";
  const map: Record<string, string> = {
    active: "Activo",
    paused: "Pausado",
    prospect: "Prospecto",
  };
  return map[normalized] ?? status;
}

export function getStatusBadgeClass(status: string) {
  const normalized = status?.toLowerCase?.() ?? "";
  switch (normalized) {
    case "new":
    case "review":
    case "screening":
    case "on_hold":
      return "badge-pending";
    case "interview":
      return "badge-draft";
    case "offer":
    case "hired":
    case "active":
    case "approved":
    case "available":
      return "badge-active";
    case "rejected":
    case "withdrawn":
      return "badge-rejected";
    case "inactive":
    case "paused":
    case "archived":
    case "offline":
      return "badge-archived";
    case "pending":
    case "prospect":
    case "busy":
      return "badge-pending";
    default:
      return "badge-draft";
  }
}

export function getInitials(value?: string | null) {
  if (!value) return "NS";
  const parts = value.split(" ").filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "NS";
}

export function getAvatarHue(seed?: string | null) {
  if (!seed) return 220;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
