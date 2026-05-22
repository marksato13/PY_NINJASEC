import Swal from "sweetalert2";

const baseAlert = Swal.mixin({
  background: "var(--panel-strong)",
  color: "var(--text)",
  buttonsStyling: false,
  customClass: {
    confirmButton: "button button-primary",
    cancelButton:  "button button-ghost",
    actions:       "panel-actions",
  },
});

type ConfirmOptions = {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
};

// ── Confirmación genérica ──────────────────────────────────────────────
export async function confirmAction({
  title       = "Confirmar acción",
  text        = "Esta acción no se puede deshacer.",
  confirmText = "Confirmar",
  cancelText  = "Cancelar",
}: ConfirmOptions) {
  const result = await baseAlert.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText:  cancelText,
    reverseButtons: true,
  });
  return result.isConfirmed;
}

// ── Confirmación de ELIMINAR — icono rojo + botón rojo pill ───────────
export async function confirmDelete({
  title       = "¿Eliminar este registro?",
  text        = "Esta acción eliminará el registro permanentemente y no se puede deshacer.",
  confirmText = "Sí, eliminar",
  cancelText  = "Cancelar",
}: ConfirmOptions = {}) {
  const result = await baseAlert.fire({
    icon: "error",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText:  cancelText,
    reverseButtons: true,
    customClass: {
      popup:         "swal2-confirm-pill",
      confirmButton: "button button-danger button-pill",
      cancelButton:  "button button-ghost button-pill",
      actions:       "panel-actions",
    },
  });
  return result.isConfirmed;
}

// ── Confirmación ESTRICTA — requiere tipear un valor para habilitar ───
export async function confirmDeleteStrict({
  title,
  text,
  expected,
  inputLabel = "Escribe el valor para confirmar:",
  confirmText = "Eliminar definitivamente",
  cancelText = "Cancelar",
}: {
  title: string;
  text: string;
  expected: string;
  inputLabel?: string;
  confirmText?: string;
  cancelText?: string;
}) {
  const result = await baseAlert.fire({
    icon: "error",
    title,
    html: `<p style="text-align:center;margin-bottom:8px">${text}</p><p style="text-align:center;font-size:0.85rem;color:var(--muted)">${inputLabel} <strong>${expected}</strong></p>`,
    input: "text",
    inputAttributes: { autocapitalize: "off", autocorrect: "off" },
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    customClass: {
      popup:         "swal2-confirm-pill",
      confirmButton: "button button-danger button-pill",
      cancelButton:  "button button-ghost button-pill",
      actions:       "panel-actions",
    },
    preConfirm: (value) => {
      if (value !== expected) {
        Swal.showValidationMessage("El valor ingresado no coincide.");
        return false;
      }
      return true;
    },
  });
  return result.isConfirmed;
}

// ── Confirmación de APROBAR — icono verde + botón verde pill ──────────
export async function confirmApprove({
  title       = "¿Aprobar este elemento?",
  text        = "Una vez aprobado, el cambio será visible de inmediato.",
  confirmText = "Sí, aprobar",
  cancelText  = "Cancelar",
}: ConfirmOptions = {}) {
  const result = await baseAlert.fire({
    icon: "success",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText:  cancelText,
    reverseButtons: true,
    customClass: {
      popup:         "swal2-confirm-pill",
      confirmButton: "button button-success button-pill",
      cancelButton:  "button button-ghost button-pill",
      actions:       "panel-actions",
    },
  });
  return result.isConfirmed;
}

// ── Notificaciones ────────────────────────────────────────────────────
export function notifySuccess(title: string, text?: string) {
  return baseAlert.fire({
    icon: "success",
    title,
    text,
    timer: 2200,
    showConfirmButton: false,
  });
}

export function notifyError(title: string, text?: string) {
  return baseAlert.fire({
    icon: "error",
    title,
    text,
    customClass: {
      popup:         "swal2-confirm-pill",
      confirmButton: "button button-danger button-pill",
      actions:       "panel-actions",
    },
  });
}

export function notifyWarning(title: string, text?: string) {
  return baseAlert.fire({
    icon: "warning",
    title,
    text,
    timer: 3000,
    showConfirmButton: false,
  });
}

export function notifyInfo(title: string, text?: string) {
  return baseAlert.fire({
    icon: "info",
    title,
    text,
    timer: 2500,
    showConfirmButton: false,
  });
}
