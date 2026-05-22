type OverviewPageProps = {
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
};

export function OverviewPage({ title, eyebrow, description, bullets }: OverviewPageProps) {
  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Resumen</p>
            <h3>Vista inicial del modulo</h3>
          </div>
        </div>
        <ul className="stack-list">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
