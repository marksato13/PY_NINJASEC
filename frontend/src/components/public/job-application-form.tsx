"use client";

import { FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8021/api/v1";

export function JobApplicationForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [skills, setSkills] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    try {
      const response = await fetch(`${API_URL}/job-applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          desired_role: desiredRole,
          skills_summary: skills,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar la postulacion");
      }

      setStatus("Postulacion enviada correctamente.");
      setFullName("");
      setEmail("");
      setDesiredRole("");
      setSkills("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ocurrio un error");
    }
  }

  return (
    <form className="public-form" onSubmit={handleSubmit}>
      <h3>Quiero formar parte de NinjaSec</h3>
      <input placeholder="Nombre completo" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      <input placeholder="Correo" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <input placeholder="Rol o cargo deseado" value={desiredRole} onChange={(event) => setDesiredRole(event.target.value)} required />
      <textarea placeholder="Resumen de habilidades y experiencia" value={skills} onChange={(event) => setSkills(event.target.value)} rows={5} required />
      {status ? <p className="form-status">{status}</p> : null}
      <button className="button button-primary" type="submit">Enviar postulacion</button>
    </form>
  );
}
