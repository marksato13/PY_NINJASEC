from datetime import UTC, datetime


def utcnow() -> datetime:
    """
    Retorna la hora actual en UTC como datetime naive.
    Los modelos usan TIMESTAMP WITHOUT TIME ZONE, por lo que psycopg3
    rechaza datetimes con tzinfo. Usar esta función hasta migrar las
    columnas a TIMESTAMPTZ.
    """
    return datetime.now(UTC).replace(tzinfo=None)
