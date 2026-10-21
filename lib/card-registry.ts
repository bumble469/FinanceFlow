export interface CardEntry {
  tabId: string;
  /**
   * URL relative to base, e.g. "/api/plan/[id]/analytics/summary".
   * The "[id]" placeholder is replaced with the plan id at fetch time.
   */
  endpoint?: string;
}

export const CARD_REGISTRY: CardEntry[] = [
  { tabId: "summary",     endpoint: "/api/plan/[id]/analytics/summary" },
  { tabId: "planning",    endpoint: "/api/plan/[id]/analytics/planning" },
  { tabId: "workspace",   endpoint: "/api/plan/[id]/analytics/workspace" },
  { tabId: "team",        endpoint: "/api/plan/[id]/analytics/team" },
  { tabId: "revenue",     endpoint: "/api/plan/[id]/analytics/revenue" },
  { tabId: "hardware",    endpoint: "/api/plan/[id]/analytics/hardware" },
  { tabId: "attendance",  endpoint: "/api/plan/[id]/analytics/attendance" },
  { tabId: "reports",     endpoint: "/api/plan/[id]/analytics/reports" },
];
