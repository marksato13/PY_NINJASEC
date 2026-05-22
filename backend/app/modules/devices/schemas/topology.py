from app.common.schemas.base import ORMModel


class TopologyNode(ORMModel):
    id: int
    label: str
    device_type: str | None = None
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    status: str
    criticality: str | None = None
    data_classification: str | None = None
    site_id: int | None = None
    responsible_user_id: int | None = None
    responsible_user_name: str | None = None
    integration_id: int | None = None


class TopologyEdge(ORMModel):
    id: int
    source: int
    target: int
    link_type: str
    port_source: str | None = None
    port_target: str | None = None
    vlan_id: int | None = None
    bandwidth_mbps: int | None = None


class TopologyCluster(ORMModel):
    label: str
    site_id: int | None = None
    node_ids: list[int]


class TopologyResponse(ORMModel):
    client_id: int
    client_name: str | None = None
    nodes: list[TopologyNode]
    edges: list[TopologyEdge]
    clusters: list[TopologyCluster]
