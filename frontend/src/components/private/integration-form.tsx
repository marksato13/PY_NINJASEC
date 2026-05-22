"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { createIntegration, DashboardClient } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type ConnectorType = "pfSense" | "FortiGate";

type IntegrationFormProps = {
  clients: DashboardClient[];
  onCreated: () => void;
};

export function IntegrationForm({ clients, onCreated }: IntegrationFormProps) {
  const currentUser = getStoredUser();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [connectorType, setConnectorType] = useState<ConnectorType>("pfSense");
  const [clientId, setClientId] = useState("");
  const [inventoryConfirmed, setInventoryConfirmed] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryConfirmed) {
      setStatus("Confirma primero que el cliente ya tiene equipos en Inventario.");
      return;
    }
    if (!clientId) {
      setStatus("Selecciona un cliente para crear la integración.");
      return;
    }
    if (!currentUser?.organization_id) {
      setStatus("No se pudo detectar la organización de tu sesión.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createIntegration({
        organization_id: currentUser.organization_id,
        client_id: Number(clientId),
        connector_type: connectorType,
        name,
        base_url: baseUrl,
      });

      setStatus("Integración registrada");
      setName("");
      setBaseUrl("");
      setClientId("");
      setInventoryConfirmed(false);
      onCreated();
    } catch {
      setStatus("No se pudo registrar la integración");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <h3>Nueva integración</h3>
      <p className="form-status">
        Flujo recomendado: primero registrar equipos en <Link href="/dashboard/devices">Inventario</Link> y luego integrar firewall.
      </p>
      <select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
        <option value="">Seleccionar cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={String(client.id)}>{client.company_name}</option>
        ))}
      </select>
      <input placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
      <input placeholder="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
      <select value={connectorType} onChange={(event) => setConnectorType(event.target.value as ConnectorType)}>
        <option value="pfSense">pfSense</option>
        <option value="FortiGate">FortiGate</option>
      </select>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={inventoryConfirmed}
          onChange={(event) => setInventoryConfirmed(event.target.checked)}
        />
        Confirmo que primero se revisó/cargó el inventario de equipos del cliente.
      </label>
      {status ? <p className="form-status">{status}</p> : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting || !inventoryConfirmed}>
        {isSubmitting ? "Creando..." : "Crear integración"}
      </button>
    </form>
  );
}
