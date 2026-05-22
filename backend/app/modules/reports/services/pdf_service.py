import io
from datetime import datetime

from app.core.time_utils import utcnow

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.db.models.client import Client

# ---------------------------------------------------------------------------
# Paleta corporativa NinjaSec
# ---------------------------------------------------------------------------
_DARK    = colors.HexColor("#1E293B")
_DARKER  = colors.HexColor("#0F172A")
_WHITE   = colors.HexColor("#F8FAFC")
_MUTED   = colors.HexColor("#94A3B8")
_ALT     = colors.HexColor("#F1F5F9")
_DANGER  = colors.HexColor("#EF4444")
_WARNING = colors.HexColor("#F59E0B")
_SUCCESS = colors.HexColor("#10B981")
_BORDER  = colors.HexColor("#CBD5E1")

_SEVERITY_COLOR = {
    "critical": _DANGER,
    "high":     _WARNING,
    "medium":   colors.HexColor("#3B82F6"),
    "low":      _SUCCESS,
}

_PAGE_W, _PAGE_H = A4
_MARGIN = 18 * mm


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ns_title",
            parent=base["Normal"],
            fontSize=20,
            textColor=_WHITE,
            fontName="Helvetica-Bold",
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "ns_subtitle",
            parent=base["Normal"],
            fontSize=10,
            textColor=_MUTED,
            fontName="Helvetica",
        ),
        "section": ParagraphStyle(
            "ns_section",
            parent=base["Normal"],
            fontSize=11,
            textColor=_WHITE,
            fontName="Helvetica-Bold",
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "ns_body",
            parent=base["Normal"],
            fontSize=9,
            textColor=_DARKER,
            fontName="Helvetica",
            leading=13,
        ),
        "kv_label": ParagraphStyle(
            "ns_kv_label",
            parent=base["Normal"],
            fontSize=9,
            textColor=_DARKER,
            fontName="Helvetica-Bold",
        ),
        "kv_value": ParagraphStyle(
            "ns_kv_value",
            parent=base["Normal"],
            fontSize=9,
            textColor=_DARKER,
            fontName="Helvetica",
        ),
        "footer": ParagraphStyle(
            "ns_footer",
            parent=base["Normal"],
            fontSize=8,
            textColor=_MUTED,
            fontName="Helvetica",
        ),
    }


def _header_style(col_count: int) -> TableStyle:
    return TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), _DARK),
        ("TEXTCOLOR",    (0, 0), (-1, 0), _WHITE),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 8),
        ("ALIGN",        (0, 0), (-1, 0), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _ALT]),
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 1), (-1, -1), 8),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",         (0, 0), (-1, -1), 0.4, _BORDER),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING",  (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("WORDWRAP",     (0, 0), (-1, -1), True),
    ])


def _section_header(text: str, st: dict) -> list:
    return [
        Spacer(1, 6 * mm),
        Table(
            [[Paragraph(text, st["section"])]],
            colWidths=[_PAGE_W - 2 * _MARGIN],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), _DARKER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWHEIGHT", (0, 0), (-1, -1), 20),
            ]),
        ),
        Spacer(1, 2 * mm),
    ]


# ---------------------------------------------------------------------------
# Función pública
# ---------------------------------------------------------------------------

def generate_consolidated_pdf(
    client: Client,
    period_label: str,
    reviews: list,
    tickets: list,
    devices: list,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=_MARGIN,
        bottomMargin=_MARGIN,
        title=f"Informe Consolidado — {client.company_name}",
        author="NinjaSec Platform",
    )

    st = _styles()
    usable_w = _PAGE_W - 2 * _MARGIN
    story: list = []

    # -----------------------------------------------------------------------
    # Portada / cabecera
    # -----------------------------------------------------------------------
    story.append(
        Table(
            [[
                Paragraph("INFORME EJECUTIVO CONSOLIDADO", st["title"]),
                Paragraph("NinjaSec Platform", st["subtitle"]),
            ]],
            colWidths=[usable_w * 0.72, usable_w * 0.28],
            style=TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), _DARKER),
                ("LEFTPADDING",   (0, 0), (-1, -1), 10),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
                ("TOPPADDING",    (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN",         (1, 0), (1, 0), "RIGHT"),
            ]),
        )
    )
    story.append(Spacer(1, 4 * mm))

    # -----------------------------------------------------------------------
    # Datos del cliente + KPIs
    # -----------------------------------------------------------------------
    total_rev  = len(reviews)
    exec_rev   = sum(1 for r in reviews if r.executed_at)
    exec_pct   = round(exec_rev / total_rev * 100, 1) if total_rev else 0.0
    all_fnds   = [f for r in reviews for f in r.findings]
    crit_open  = sum(
        1 for f in all_fnds
        if str(f.severity) in ("critical", "high") and str(f.status) == "open"
    )
    open_tkts  = sum(
        1 for t in tickets if str(t.status) in ("open", "in_progress", "pending")
    )

    info_data = [
        [Paragraph("Empresa",    st["kv_label"]), Paragraph(client.company_name, st["kv_value"])],
        [Paragraph("Sector",     st["kv_label"]), Paragraph(client.sector or "—", st["kv_value"])],
        [Paragraph("Tamaño",     st["kv_label"]), Paragraph(client.size or "—", st["kv_value"])],
        [Paragraph("Período",    st["kv_label"]), Paragraph(period_label, st["kv_value"])],
        [Paragraph("Generado",   st["kv_label"]), Paragraph(utcnow().strftime("%Y-%m-%d %H:%M UTC"), st["kv_value"])],
    ]
    kpi_data = [
        [Paragraph("KPI",             st["kv_label"]), Paragraph("Valor", st["kv_label"])],
        [Paragraph("Revisiones programadas",     st["body"]), Paragraph(str(total_rev), st["body"])],
        [Paragraph("Revisiones ejecutadas",      st["body"]), Paragraph(f"{exec_rev} ({exec_pct}%)", st["body"])],
        [Paragraph("Hallazgos totales",          st["body"]), Paragraph(str(len(all_fnds)), st["body"])],
        [Paragraph("Hallazgos críticos abiertos", st["body"]), Paragraph(str(crit_open), st["body"])],
        [Paragraph("Tickets totales",            st["body"]), Paragraph(str(len(tickets)), st["body"])],
        [Paragraph("Tickets abiertos",           st["body"]), Paragraph(str(open_tkts), st["body"])],
        [Paragraph("Activos registrados",        st["body"]), Paragraph(str(len(devices)), st["body"])],
    ]

    half = usable_w / 2 - 3 * mm
    summary_table = Table(
        [[
            Table(info_data, colWidths=[half * 0.38, half * 0.62],
                  style=_header_style(2)),
            Table(kpi_data,  colWidths=[half * 0.62, half * 0.38],
                  style=_header_style(2)),
        ]],
        colWidths=[half, half],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                          ("LEFTPADDING", (1, 0), (1, 0), 6 * mm)]),
    )
    story.append(summary_table)

    # -----------------------------------------------------------------------
    # Revisiones de seguridad
    # -----------------------------------------------------------------------
    story += _section_header("REVISIONES DE SEGURIDAD", st)
    if reviews:
        rev_rows = [["ID", "Estado", "Fecha programada", "Fecha ejecución", "Hallazgos", "Notas"]]
        for r in reviews:
            rev_rows.append([
                str(r.id),
                str(r.status),
                r.scheduled_at.strftime("%Y-%m-%d") if r.scheduled_at else "—",
                r.executed_at.strftime("%Y-%m-%d")  if r.executed_at  else "—",
                str(len(r.findings)),
                (r.notes or "")[:60] + ("…" if r.notes and len(r.notes) > 60 else ""),
            ])
        col_w = [usable_w * p for p in (0.06, 0.10, 0.16, 0.16, 0.10, 0.42)]
        story.append(Table(rev_rows, colWidths=col_w, style=_header_style(6),
                           repeatRows=1))
    else:
        story.append(Paragraph("Sin revisiones en el período.", st["body"]))

    # -----------------------------------------------------------------------
    # Hallazgos
    # -----------------------------------------------------------------------
    story += _section_header("HALLAZGOS", st)
    if all_fnds:
        fnd_rows = [["ID", "Revisión", "Severidad", "Título", "Estado"]]
        for f in all_fnds:
            fnd_rows.append([
                str(f.id),
                str(f.review_id),
                str(f.severity),
                f.title[:55] + ("…" if len(f.title) > 55 else ""),
                str(f.status),
            ])
        col_w = [usable_w * p for p in (0.06, 0.10, 0.12, 0.56, 0.16)]
        fnd_ts = _header_style(5)
        # Colorear celdas de severidad por fila
        for i, f in enumerate(all_fnds, start=1):
            sev = str(f.severity)
            c = _SEVERITY_COLOR.get(sev, _MUTED)
            fnd_ts.add("TEXTCOLOR", (2, i), (2, i), c)
            fnd_ts.add("FONTNAME",  (2, i), (2, i), "Helvetica-Bold")
        story.append(Table(fnd_rows, colWidths=col_w, style=fnd_ts, repeatRows=1))
    else:
        story.append(Paragraph("Sin hallazgos en el período.", st["body"]))

    # -----------------------------------------------------------------------
    # Tickets de soporte
    # -----------------------------------------------------------------------
    story += _section_header("TICKETS DE SOPORTE", st)
    if tickets:
        now = utcnow()
        tkt_rows = [["ID", "Título", "Prioridad", "Estado", "Días abierto", "Fecha apertura"]]
        for t in tickets:
            ref = t.closed_at or now
            days = (ref - t.opened_at).days if t.opened_at else "—"
            tkt_rows.append([
                str(t.id),
                t.title[:45] + ("…" if len(t.title) > 45 else ""),
                str(t.priority),
                str(t.status),
                str(days),
                t.opened_at.strftime("%Y-%m-%d") if t.opened_at else "—",
            ])
        col_w = [usable_w * p for p in (0.06, 0.40, 0.12, 0.14, 0.14, 0.14)]
        story.append(Table(tkt_rows, colWidths=col_w, style=_header_style(6),
                           repeatRows=1))
    else:
        story.append(Paragraph("Sin tickets en el período.", st["body"]))

    # -----------------------------------------------------------------------
    # Inventario de activos
    # -----------------------------------------------------------------------
    story += _section_header("INVENTARIO DE ACTIVOS", st)
    if devices:
        inv_rows = [["ID", "Hostname", "Tipo", "Vendor", "IP", "Estado"]]
        for d in devices:
            inv_rows.append([
                str(d.id),
                d.hostname,
                d.device_type or "—",
                d.vendor or "—",
                d.ip_address or "—",
                str(d.status),
            ])
        col_w = [usable_w * p for p in (0.06, 0.26, 0.14, 0.14, 0.18, 0.22)]
        story.append(Table(inv_rows, colWidths=col_w, style=_header_style(6),
                           repeatRows=1))
    else:
        story.append(Paragraph("Sin activos registrados.", st["body"]))

    # -----------------------------------------------------------------------
    # Pie de página inline (último elemento)
    # -----------------------------------------------------------------------
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Generado por NinjaSec Platform · {utcnow().strftime('%Y-%m-%d %H:%M UTC')} · Confidencial",
        st["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Reporte individual de revisión de seguridad
# ---------------------------------------------------------------------------

def generate_security_review_pdf(
    review,
    client: Client | None,
    integration,
    reviewer_name: str | None,
    findings: list,
    checklist_items: list,
    recommendations: list,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=_MARGIN,
        bottomMargin=_MARGIN,
        title=f"Revisión #{review.id} — {client.company_name if client else 'Cliente'}",
        author="NinjaSec Platform",
    )
    st = _styles()
    usable_w = _PAGE_W - 2 * _MARGIN
    story: list = []

    # ── Portada ────────────────────────────────────────────────────────────
    story.append(
        Table(
            [[
                Paragraph(f"INFORME DE REVISIÓN #{review.id}", st["title"]),
                Paragraph("NinjaSec Platform", st["subtitle"]),
            ]],
            colWidths=[usable_w * 0.72, usable_w * 0.28],
            style=TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), _DARKER),
                ("LEFTPADDING",   (0, 0), (-1, -1), 10),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
                ("TOPPADDING",    (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN",         (1, 0), (1, 0), "RIGHT"),
            ]),
        )
    )
    story.append(Spacer(1, 4 * mm))

    # ── Resumen ejecutivo ──────────────────────────────────────────────────
    total_findings = len(findings)
    by_sev: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for f in findings:
        sev = str(f.severity)
        sts = str(f.status)
        by_sev[sev] = by_sev.get(sev, 0) + 1
        by_status[sts] = by_status.get(sts, 0) + 1
    crit_open = sum(
        1 for f in findings
        if str(f.severity) in ("critical", "high") and str(f.status) == "open"
    )
    cl_total = len(checklist_items)
    cl_pass = sum(1 for c in checklist_items if (c.result or "") == "pass")
    cl_pct  = round(cl_pass / cl_total * 100, 1) if cl_total else 0.0

    # Determine veredict
    if crit_open == 0 and total_findings == 0:
        veredict = "✓ Postura adecuada — sin hallazgos abiertos relevantes."
        veredict_color = _SUCCESS
    elif crit_open == 0:
        veredict = "○ Postura aceptable con observaciones menores."
        veredict_color = _WARNING
    else:
        veredict = f"✗ Atención inmediata — {crit_open} hallazgo(s) crítico/alto sin resolver."
        veredict_color = _DANGER

    story += _section_header("RESUMEN EJECUTIVO", st)
    summary_para = ParagraphStyle(
        "exec_summary",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=10,
        textColor=_DARKER,
        fontName="Helvetica",
        leading=15,
        spaceAfter=4,
    )
    veredict_para = ParagraphStyle(
        "exec_verdict",
        parent=summary_para,
        fontSize=11,
        textColor=veredict_color,
        fontName="Helvetica-Bold",
    )
    story.append(Paragraph(veredict, veredict_para))
    story.append(Spacer(1, 2 * mm))
    summary_text = (
        f"Esta revisión evaluó la integración <b>{integration.name if integration else '—'}</b> "
        f"({integration.connector_type if integration else '—'}) "
        f"del cliente <b>{client.company_name if client else '—'}</b>. "
        f"Se registraron <b>{total_findings}</b> hallazgo(s) en total "
        f"({by_sev.get('critical', 0)} crítico, {by_sev.get('high', 0)} alto, "
        f"{by_sev.get('medium', 0)} medio, {by_sev.get('low', 0)} bajo, {by_sev.get('info', 0)} info) "
        f"y el checklist alcanzó <b>{cl_pct}%</b> de cumplimiento "
        f"({cl_pass} de {cl_total} ítems en estado pass)."
    )
    story.append(Paragraph(summary_text, summary_para))

    # ── Datos de la revisión ───────────────────────────────────────────────
    story += _section_header("DATOS DE LA REVISIÓN", st)
    info_rows = [
        [Paragraph("Cliente",       st["kv_label"]), Paragraph(client.company_name if client else "—", st["kv_value"])],
        [Paragraph("Sector",        st["kv_label"]), Paragraph((client.sector if client else None) or "—", st["kv_value"])],
        [Paragraph("Consola",       st["kv_label"]), Paragraph(integration.name if integration else "—", st["kv_value"])],
        [Paragraph("Tipo conector", st["kv_label"]), Paragraph(integration.connector_type if integration else "—", st["kv_value"])],
        [Paragraph("Programada",    st["kv_label"]), Paragraph(review.scheduled_at.strftime("%Y-%m-%d") if review.scheduled_at else "—", st["kv_value"])],
        [Paragraph("Ejecutada",     st["kv_label"]), Paragraph(review.executed_at.strftime("%Y-%m-%d")  if review.executed_at  else "—", st["kv_value"])],
        [Paragraph("Estado",        st["kv_label"]), Paragraph(str(review.status), st["kv_value"])],
        [Paragraph("Revisor",       st["kv_label"]), Paragraph(reviewer_name or "—", st["kv_value"])],
    ]
    story.append(Table(info_rows, colWidths=[usable_w * 0.28, usable_w * 0.72], style=_header_style(2)))

    # ── KPIs de hallazgos ──────────────────────────────────────────────────
    story += _section_header("ESTADÍSTICAS DE HALLAZGOS", st)
    kpi_rows = [
        [Paragraph("Indicador", st["kv_label"]), Paragraph("Valor", st["kv_label"])],
        [Paragraph("Total hallazgos",          st["body"]), Paragraph(str(total_findings), st["body"])],
        [Paragraph("Críticos",                  st["body"]), Paragraph(str(by_sev.get("critical", 0)), st["body"])],
        [Paragraph("Altos",                     st["body"]), Paragraph(str(by_sev.get("high", 0)), st["body"])],
        [Paragraph("Medios",                    st["body"]), Paragraph(str(by_sev.get("medium", 0)), st["body"])],
        [Paragraph("Bajos",                     st["body"]), Paragraph(str(by_sev.get("low", 0)), st["body"])],
        [Paragraph("Info",                      st["body"]), Paragraph(str(by_sev.get("info", 0)), st["body"])],
        [Paragraph("Abiertos sin resolver",     st["body"]), Paragraph(str(by_status.get("open", 0)), st["body"])],
        [Paragraph("Crít/Alto abiertos",        st["body"]), Paragraph(str(crit_open), st["body"])],
        [Paragraph("Cumplimiento checklist",    st["body"]), Paragraph(f"{cl_pct}% ({cl_pass}/{cl_total})", st["body"])],
    ]
    story.append(Table(kpi_rows, colWidths=[usable_w * 0.55, usable_w * 0.45], style=_header_style(2)))

    # ── Checklist ──────────────────────────────────────────────────────────
    story += _section_header("CHECKLIST DE VERIFICACIÓN", st)
    if checklist_items:
        cl_rows = [["#", "Criterio", "Resultado", "Notas"]]
        for i, c in enumerate(checklist_items, 1):
            cl_rows.append([
                str(i),
                (c.criteria or "")[:70],
                (c.result or "—"),
                (c.notes or "")[:60] + ("…" if c.notes and len(c.notes) > 60 else ""),
            ])
        story.append(Table(cl_rows, colWidths=[usable_w * 0.06, usable_w * 0.46, usable_w * 0.14, usable_w * 0.34], style=_header_style(4), repeatRows=1))
    else:
        story.append(Paragraph("Sin ítems de checklist registrados.", st["body"]))

    # ── Hallazgos en detalle ───────────────────────────────────────────────
    story += _section_header("HALLAZGOS EN DETALLE", st)
    if findings:
        fnd_rows = [["#", "Severidad", "Título", "Estado", "Descripción"]]
        for i, f in enumerate(findings, 1):
            fnd_rows.append([
                str(i),
                str(f.severity),
                (f.title or "")[:50],
                str(f.status),
                (f.description or "")[:80] + ("…" if f.description and len(f.description) > 80 else ""),
            ])
        col_w = [usable_w * p for p in (0.05, 0.12, 0.30, 0.13, 0.40)]
        fnd_ts = _header_style(5)
        for i, f in enumerate(findings, start=1):
            sev = str(f.severity)
            c = _SEVERITY_COLOR.get(sev, _MUTED)
            fnd_ts.add("TEXTCOLOR", (1, i), (1, i), c)
            fnd_ts.add("FONTNAME",  (1, i), (1, i), "Helvetica-Bold")
        story.append(Table(fnd_rows, colWidths=col_w, style=fnd_ts, repeatRows=1))
    else:
        story.append(Paragraph("Sin hallazgos en esta revisión.", st["body"]))

    # ── Recomendaciones ────────────────────────────────────────────────────
    story += _section_header("RECOMENDACIONES", st)
    if recommendations:
        rec_rows = [["#", "Recomendación", "Estado", "Fecha límite"]]
        for i, r in enumerate(recommendations, 1):
            rec_rows.append([
                str(i),
                (r.recommendation or "")[:90],
                str(r.status),
                r.due_date.strftime("%Y-%m-%d") if r.due_date else "—",
            ])
        col_w = [usable_w * p for p in (0.05, 0.65, 0.14, 0.16)]
        story.append(Table(rec_rows, colWidths=col_w, style=_header_style(4), repeatRows=1))
    else:
        story.append(Paragraph("Sin recomendaciones registradas.", st["body"]))

    # ── Notas internas ─────────────────────────────────────────────────────
    if review.notes:
        story += _section_header("NOTAS DE LA REVISIÓN", st)
        story.append(Paragraph(review.notes, st["body"]))

    # ── Footer ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Generado por NinjaSec Platform · {utcnow().strftime('%Y-%m-%d %H:%M UTC')} · Confidencial",
        st["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()
