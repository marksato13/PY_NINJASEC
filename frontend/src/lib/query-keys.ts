// Centralized TanStack Query key factory
// Usage: queryKey: QK.users()  |  queryClient.invalidateQueries({ queryKey: QK.users() })

export const QK = {
  // Auth
  me:              ()                          => ["me"]                         as const,

  // Users
  users:           ()                          => ["users"]                      as const,
  user:            (id: number)                => ["users", id]                  as const,

  // Clients
  clients:         ()                          => ["clients"]                    as const,
  client:          (id: number)                => ["clients", id]                as const,
  clientSites:     (clientId: number)          => ["clients", clientId, "sites"]      as const,
  clientContacts:  (clientId: number)          => ["clients", clientId, "contacts"]   as const,
  clientServices:  (clientId: number)          => ["clients", clientId, "services"]   as const,
  clientAccess:    (clientId: number)          => ["clients", clientId, "access"]     as const,

  // Collaborators
  collaborators:   ()                          => ["collaborators"]              as const,

  // Devices
  devices:         (f?: object)               => ["devices", f]                 as const,

  // Integrations
  integrations:    (clientId?: number)         => ["integrations", clientId]     as const,
  integration:     (id: number)               => ["integrations", id]           as const,

  // Security Reviews
  reviews:         (f?: object)               => ["reviews", f]                 as const,
  review:          (id: number)               => ["reviews", id]                as const,

  // Support Tickets
  tickets:         (f?: object)               => ["tickets", f]                 as const,
  ticket:          (id: number)               => ["tickets", id]                as const,

  // Leads
  leads:           ()                          => ["leads"]                      as const,

  // Projects
  projects:        ()                          => ["projects"]                   as const,
  project:         (id: number)               => ["projects", id]               as const,
  projectMembers:  (id: number)               => ["projects", id, "members"]    as const,

  // Services
  services:        ()                          => ["services"]                   as const,
  serviceRequests: ()                          => ["service-requests"]           as const,

  // Reports
  reports:         ()                          => ["reports"]                    as const,
  reportRuns:      ()                          => ["report-runs"]                as const,

  // Alerts
  alerts:          (clientId?: number)         => ["alerts", clientId]           as const,

  // Audit
  auditLogs:       (limit?: number)            => ["audit-logs", limit]          as const,

  // Dashboard
  dashboardSummary: (f?: object)              => ["dashboard-summary", f]       as const,

  // Skills
  skills:          ()                          => ["skills"]                     as const,
  userSkills:      ()                          => ["user-skills"]                as const,
  certifications:  ()                          => ["certifications"]             as const,

  // Docs
  docTypes:        ()                          => ["doc-types"]                  as const,
  projectDocs:     (f?: object)               => ["project-docs", f]            as const,

  // Recruitment
  jobApplications: (f?: object)               => ["job-applications", f]        as const,
  jobApplication:  (id: number)               => ["job-applications", id]       as const,

  // Catalogs
  areas:           ()                          => ["areas"]                      as const,
  projectTypes:    ()                          => ["project-types"]              as const,
  products:        ()                          => ["products"]                   as const,
} as const;
