from datetime import datetime

from app.core.time_utils import utcnow


def simulate_connector_test(connector_type: str, base_url: str) -> dict[str, object]:
    connector = connector_type.lower()
    if connector == "pfsense":
        return {
            "reachable": True,
            "message": f"pfSense endpoint reachable at {base_url}",
            "devices": [
                {
                    "hostname": "pfsense-main",
                    "vendor": "pfSense",
                    "model": "Virtual Appliance",
                    "ip_address": "10.0.0.1",
                    "device_type": "firewall",
                    "status": "healthy",
                }
            ],
            "snapshot": {
                "snapshot_type": "traffic_summary",
                "raw_payload": '{"wan_status":"up","vpn_sessions":12,"traffic_gb":128}',
                "normalized_payload": '{"uptime_status":"up","active_vpn_sessions":12,"traffic_total_gb":128}',
            },
        }

    if connector == "fortigate":
        return {
            "reachable": True,
            "message": f"FortiGate endpoint reachable at {base_url}",
            "devices": [
                {
                    "hostname": "fortigate-branch-01",
                    "vendor": "FortiGate",
                    "model": "FortiGate VM",
                    "ip_address": "10.0.10.1",
                    "device_type": "firewall",
                    "status": "warning",
                }
            ],
            "snapshot": {
                "snapshot_type": "security_summary",
                "raw_payload": '{"threat_events":5,"ips_blocks":3,"wan_status":"degraded"}',
                "normalized_payload": '{"threat_events":5,"blocked_intrusions":3,"uptime_status":"degraded"}',
            },
        }

    return {
        "reachable": False,
        "message": f"Connector {connector_type} is not supported yet",
        "devices": [],
        "snapshot": {
            "snapshot_type": "unsupported",
            "raw_payload": "{}",
            "normalized_payload": "{}",
            "created_at": utcnow().isoformat(),
        },
    }
