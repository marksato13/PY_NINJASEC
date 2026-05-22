from __future__ import annotations

from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models.client import Client
from app.db.models.client_site import ClientSite
from app.db.models.device import Device
from app.db.models.device_connection import DeviceConnection
from app.db.models.integration import Integration
from app.db.models.user import User
from app.modules.devices.schemas import (
    TopologyCluster,
    TopologyEdge,
    TopologyNode,
    TopologyResponse,
)


class TopologyService:
    def __init__(self, db: Session, current_user):
        self.db = db
        self.current_user = current_user

    def build(self, client_id: int) -> TopologyResponse:
        client = self.db.get(Client, client_id)
        if not client or client.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Client not found")

        devices = list(self.db.scalars(
            select(Device)
            .options(selectinload(Device.responsible_user))
            .join(Integration, Device.integration_id == Integration.id)
            .where(
                Integration.client_id == client_id,
                Integration.organization_id == self.current_user.organization_id,
            )
        ).all())

        device_ids = [d.id for d in devices]
        nodes: list[TopologyNode] = []
        for d in devices:
            owner_name: str | None = None
            if d.responsible_user_id:
                user = self.db.get(User, d.responsible_user_id)
                owner_name = user.full_name if user else None
            nodes.append(TopologyNode(
                id=d.id,
                label=d.hostname,
                device_type=d.device_type,
                vendor=d.vendor,
                model=d.model,
                ip_address=d.ip_address,
                status=d.status,
                criticality=d.criticality,
                data_classification=d.data_classification,
                site_id=d.site_id,
                responsible_user_id=d.responsible_user_id,
                responsible_user_name=owner_name,
                integration_id=d.integration_id,
            ))

        edges: list[TopologyEdge] = []
        if device_ids:
            conns = self.db.scalars(
                select(DeviceConnection).where(
                    DeviceConnection.source_device_id.in_(device_ids),
                    DeviceConnection.target_device_id.in_(device_ids),
                )
            ).all()
            for c in conns:
                edges.append(TopologyEdge(
                    id=c.id,
                    source=c.source_device_id,
                    target=c.target_device_id,
                    link_type=c.link_type,
                    port_source=c.port_source,
                    port_target=c.port_target,
                    vlan_id=c.vlan_id,
                    bandwidth_mbps=c.bandwidth_mbps,
                ))

        # Cluster por sede
        by_site: dict[int | None, list[int]] = defaultdict(list)
        for d in devices:
            by_site[d.site_id].append(d.id)
        sites = {
            s.id: s for s in self.db.scalars(
                select(ClientSite).where(ClientSite.client_id == client_id)
            ).all()
        }
        clusters: list[TopologyCluster] = []
        for site_id, node_ids in by_site.items():
            if site_id is None:
                clusters.append(TopologyCluster(label="Sin sede asignada", site_id=None, node_ids=node_ids))
            else:
                site = sites.get(site_id)
                label = site.name if site else f"Sede #{site_id}"
                clusters.append(TopologyCluster(label=label, site_id=site_id, node_ids=node_ids))

        return TopologyResponse(
            client_id=client.id,
            client_name=client.company_name,
            nodes=nodes,
            edges=edges,
            clusters=clusters,
        )
