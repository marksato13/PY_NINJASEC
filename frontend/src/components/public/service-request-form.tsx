"use client";

import { FormEvent, useEffect, useState } from "react";

type ServiceOption = {
  id: number;
  title: string;
  category?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8021/api/v1";

export function ServiceRequestForm() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadServices() {
      try {
        const response = await fetch(`${API_URL}/services/`);
        if (!response.ok) return;
        const data = (await response.json()) as ServiceOption[];
        setServices(data.filter((item) => item.id));
      } catch {
        // ignore
      }
    }

    loadServices();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const payload = {
      service_id: Number(serviceId),
      requester_name: name,
      requester_email: email,
      request_type: requestType || "General",
      message,
    };

    try {
      const response = await fetch(`${API_URL}/services/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar la solicitud");
      }

      setStatus("Solicitud enviada correctamente.");
      setServiceId("");
      setName("");
      setEmail("");
      setRequestType("");
      setMessage("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ocurrio un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="public-form" onSubmit={handleSubmit}>
      <h3>Solicitar un servicio</h3>
      <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required>
        <option value="">Selecciona un servicio</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.title}{service.category ? ` (${service.category})` : ""}
          </option>
        ))}
      </select>
      <input placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
      <input placeholder="Correo" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <input placeholder="Tipo de solicitud" value={requestType} onChange={(event) => setRequestType(event.target.value)} />
      <textarea placeholder="Describe tu necesidad" value={message} onChange={(event) => setMessage(event.target.value)} rows={5} required />
      {status ? <p className="form-status">{status}</p> : null}
      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
