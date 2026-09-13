"use client";

import { useFinancialStore } from "@/lib/store";
import { ProjectOverview } from "./project-overview";
import { EventOverview } from "./event-overview";

export function OverviewSection() {
  const { mode } = useFinancialStore();
  return mode === "project" ? <ProjectOverview /> : <EventOverview />;
}