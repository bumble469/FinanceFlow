import { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Pencil, Trash2, Circle, Loader2, CheckSquare, Users, Flag, Ban, AlertTriangle, Send } from "lucide-react";
import { EventTaskMembersDialog } from "./event-task-member-dialog";
import { cn } from "@/lib/utils";
import { ReviewSubmissionDialog } from "@/components/shared/review-submission-dialog";
import { authClient } from "@/lib/auth-client";

const STATUS_CYCLE: Task["status"][] = ["TODO", "IN_PROGRESS"];

function nextStatus(s: Task["status"]): Task["status"] | null {
  const idx = STATUS_CYCLE.indexOf(s);
  if (idx === -1) return null;
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function StatusIcon({ status }: { status: Task["status"] }) {
  if (status === "COMPLETED" || status === "DONE") return <CheckSquare className="h-4 w-4 text-success shrink-0" />;
  if (status === "SUBMITTED") return <Send className="h-4 w-4 text-blue-500 shrink-0" />;
  if (status === "CHANGES_REQUESTED") return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
  if (status === "IN_PROGRESS") return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />;
  if (status === "BLOCKED") return <Ban className="h-4 w-4 text-destructive shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", COMPLETED: "Completed",
  SUBMITTED: "Submitted", CHANGES_REQUESTED: "Changes requested", BLOCKED: "Blocked",
};

const STATUS_BADGE: Record<Task["status"], string> = {
  TODO: "bg-secondary text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary",
  DONE: "bg-success/10 text-success",
  COMPLETED: "bg-success/10 text-success",
  SUBMITTED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CHANGES_REQUESTED: "bg-warning/10 text-warning",
  BLOCKED: "bg-destructive/10 text-destructive",
};

type EventTaskListViewProps = {
  tasks: Task[];
  workItemId: string;
  deptId: string;
  onStatusChange: (id: string, status: Task["status"]) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  canApproveSubmissions?: boolean;
  onSubmissionReviewed?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function EventTaskListView({
  tasks, workItemId, deptId, onStatusChange, onEdit, onDelete, canApproveSubmissions, onSubmissionReviewed, canEdit, canDelete,
}: EventTaskListViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<Record<string, any>>({});

  const fetchPendingSubmission = async (taskId: string) => {
    try {
      const res = await authClient.request(`/api/plan/${workItemId}/departments/${deptId}/tasks/${taskId}/submissions`);
      const pending = (res.data.data || []).find((s: any) => s.status === "PENDING");
      if (pending) setPendingSubmissions((prev) => ({ ...prev, [taskId]: pending }));
    } catch (err) {
      console.error("Failed to fetch submission:", err);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed">
        <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No tasks yet</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Add a task to start tracking work in this department</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((t) => {
          const canQuickToggle = STATUS_CYCLE.includes(t.status);
          const pendingSubmission = pendingSubmissions[t.id];

          return (
            <div key={t.id} className="group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition">
              <button
                className={cn("mt-0.5 shrink-0", canQuickToggle ? "cursor-pointer" : "cursor-default")}
                title={`Status: ${STATUS_LABEL[t.status]}${canQuickToggle ? " — click to advance" : ""}`}
                onClick={() => { const next = nextStatus(t.status); if (next) onStatusChange(t.id, next); }}
                disabled={!canQuickToggle}
              >
                <StatusIcon status={t.status} />
              </button>

              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium text-foreground", (t.status === "DONE" || t.status === "COMPLETED") && "line-through text-muted-foreground")}>
                  {t.title}
                </p>
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                <span className={cn("inline-block mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status])}>
                  {STATUS_LABEL[t.status]}
                </span>

                {t.milestones && t.milestones.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {t.milestones.map((m) => {
                      const exceeds = t.dueDate && m.dueDate && new Date(t.dueDate) > new Date(m.dueDate);
                      return (
                        <span
                          key={m.id}
                          title={
                            exceeds
                              ? `Warning: this task's due date is after "${m.title}"'s milestone deadline`
                              : `Part of milestone: ${m.title} (${m.status.replace("_", " ").toLowerCase()})`
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            exceeds
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {exceeds ? <AlertTriangle className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
                          {m.title}
                        </span>
                      );
                    })}
                  </div>
                )}

                {t.dueDate && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Due {new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                )}

                {t.status === "SUBMITTED" && canApproveSubmissions && (
                  <div className="mt-2">
                    {pendingSubmission ? (
                      <ReviewSubmissionDialog
                        planId={workItemId}
                        deptId={deptId}
                        taskId={t.id}
                        submission={pendingSubmission}
                        onReviewed={() => {
                          setPendingSubmissions((prev) => { const next = { ...prev }; delete next[t.id]; return next; });
                          onSubmissionReviewed?.();
                        }}
                      />
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs cursor-pointer hover:text-gray-600" onClick={() => fetchPendingSubmission(t.id)}>
                        Load submission to review
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setSelectedTaskId(t.id)} className="cursor-pointer">
                  <Users className="h-3.5 w-3.5" />
                </Button>
                {canEdit && (
                  <Button size="icon" variant="ghost" onClick={() => onEdit(t)} className="cursor-pointer">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => onDelete(t.id)} className="cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTaskId && (
        <EventTaskMembersDialog
          open={!!selectedTaskId}
          onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}
          workItemId={workItemId}
          deptId={deptId}
          taskId={selectedTaskId}
        />
      )}
    </>
  );
}