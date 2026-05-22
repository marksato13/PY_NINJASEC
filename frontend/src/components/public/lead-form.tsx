"use client";

import { FormEvent, useState } from "react";

import { requestPublic } from "@/lib/api/client";

type LeadFormProps = {
  title: string;
  endpoint: string;
  submitLabel: string;
  payloadType: "lead" | "contact";
};

export function LeadForm({ title, endpoint, submitLabel, payloadType }: LeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [interestArea, setInterestArea] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const fallbackInterest = payloadType === "lead" ? "Demo comercial" : "Contacto general";
    const sourceTag = payloadType === "lead" ? "website" : "website-contact";

    const payload = {
      company_name: company || null,
      contact_name: name,
      email,
      phone: phone || null,
      interest_area: interestArea || fallbackInterest,
      message: message || null,
      source: sourceTag,
    };

    try {
      // Path normalization: accept "leads", "leads/", "/leads" → "/leads"
      const path = "/" + endpoint.replace(/^\/+|\/+$/g, "");
      await requestPublic<unknown>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatus({ kind: "ok", text: "Solicitud registrada. Te contactaremos en breve." });
      setName("");
      setEmail("");
      setCompany("");
      setPhone("");
      setInterestArea("");
      setMessage("");
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo registrar la solicitud",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="public-form" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <input placeholder="Nombre completo *"   value={name}    onChange={(e) => setName(e.target.value)}    required />
      <input placeholder="Correo *" type="email" value={email}   onChange={(e) => setEmail(e.target.value)}   required />
      <input placeholder="Empresa"             value={company} onChange={(e) => setCompany(e.target.value)} />
      <input placeholder="Teléfono"            value={phone}   onChange={(e) => setPhone(e.target.value)}   />
      <input placeholder="Área de interés (firewall, IDS, auditoría...)" value={interestArea} onChange={(e) => setInterestArea(e.target.value)} />
      <textarea placeholder="Describe tu necesidad *" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required />
      {status ? (
        <p className={status.kind === "ok" ? "form-success" : "form-error"}>{status.text}</p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Enviando..." : submitLabel}
      </button>
    </form>
  );
}
