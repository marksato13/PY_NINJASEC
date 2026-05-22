"use client";

import { FormEvent, useState } from "react";

import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8021/api/v1";

type ReportFormProps = {
  onCreated: () => void;
};

export function ReportForm({ onCreated }: ReportFormProps) {
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState("executive");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredToken();
    if (!token) {
      setStatus("Sesion no disponible");
      return;
    }

    const response = await fetch(`${API_URL}/reports/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organization_id: 1,
        client_id: 1,
        integration_id: 1,
        title,
        report_type: reportType,
        template_name: `${reportType}-template`,
        definition_json: '{"widgets":["traffic","security","availability"]}',
      }),
    });

    if (!response.ok) {
      setStatus("No se pudo crear el reporte");
      return;
    }

    setStatus("Reporte creado");
    setTitle("");
    onCreated();
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <h3>Nuevo reporte</h3>
      <input placeholder="Título del reporte" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
        <option value="executive">Executive</option>
        <option value="technical">Technical</option>
      </select>
      {status ? <p className="form-status">{status}</p> : null}
      <button className="button button-primary" type="submit">Crear reporte</button>
    </form>
  );
}
