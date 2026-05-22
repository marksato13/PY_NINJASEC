import { JobApplicationForm } from "@/components/public/job-application-form";
import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ColaboraPage() {
  return (
    <PublicPageShell>
      <section className="content-hero">
        <p className="eyebrow">Colabora</p>
        <h1>Forma parte de NinjaSec.</h1>
        <p>Buscamos perfiles técnicos con interés en integración API, reporting, frontend y operación tecnológica.</p>
      </section>
      <JobApplicationForm />
    </PublicPageShell>
  );
}
