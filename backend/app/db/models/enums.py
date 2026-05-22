from enum import StrEnum


class RoleCode(StrEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    COLLABORATOR = "collaborator"
    CLIENT = "client"


class UserStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ClientStatus(StrEnum):
    PROSPECT = "prospect"
    ACTIVE = "active"
    PAUSED = "paused"


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class ServiceRequestStatus(StrEnum):
    NEW    = "NEW"
    REVIEW = "REVIEW"
    CLOSED = "CLOSED"


class LeadStatus(StrEnum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    PROPOSAL = "PROPOSAL"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"
    CLOSED = "CLOSED"  # backwards compat


class JobApplicationStatus(StrEnum):
    NEW = "new"
    SCREENING = "screening"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    ON_HOLD = "on_hold"


class ApplicationRecommendation(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"
    HOLD = "hold"


class SkillStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CertificationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class DocScope(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"
    BOTH = "both"


class DocVisibility(StrEnum):
    INTERNAL = "internal"
    CLIENT = "client"


class DocStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class AssignmentType(StrEnum):
    MANUAL = "manual"
    SUGGESTED = "suggested"
    AUTO = "auto"


class IntegrationEnvironment(StrEnum):
    PROD = "prod"
    DEV = "dev"
    LAB = "lab"


class SiteStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ReviewStatus(StrEnum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class FindingSeverity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    ACCEPTED = "accepted"


class ChecklistResult(StrEnum):
    OK = "ok"
    FAIL = "fail"
    NA = "na"


class RecommendationStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketPriority(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketLinkEntity(StrEnum):
    CLIENT = "client"
    INTEGRATION = "integration"
    DEVICE = "device"
    REVIEW = "review"


class DeviceCriticality(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DeviceDataClassification(StrEnum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class DeviceLinkType(StrEnum):
    ETHERNET = "ethernet"
    WIFI = "wifi"
    WAN = "wan"
    VPN = "vpn"
    MPLS = "mpls"
    TRUNK = "trunk"
    CLOUD_PEERING = "cloud_peering"
