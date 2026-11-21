"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Users,
  ListTodo,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  CalendarClock,
  Send,
  AlertTriangle,
  History,
  FileText,
  Image as ImageIcon,
  Video,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { useSnackbar } from "@/lib/useSnackbar";
import { getPermissions, type PlanPermissions } from "@/lib/permissions";
import { RequestExtensionDialog } from "@/components/shared/request-extension-dialog";
import { DepartmentExtensionRequestsDialog } from "./components/department-extension-requests-dialog";
import { SubmitWorkDialog } from "@/components/shared/submit-work-dialog";
import { ReviewSubmissionDialog } from "@/components/shared/review-submission-dialog";
import { TaskRequirement } from "@/lib/types";

// ─── types ───────────────────────────────────────────────────────────────

type DeptCard = {
  id: string;
  name: string;
  memberCount: number;
  taskStats: { total: number; pending: number; ongoing: number; completed: number };
};

type Assignee = { workItemMemberId: string; name: string | null; image: string | null };
type Reaction = { id: string; emoji: string; authorName: string | null; authorId: string };
type Note = { id: string; body: string; authorName: string | null; createdAt: string };

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SUBMITTED" | "CHANGES_REQUESTED" | "COMPLETED";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  departmentId: string | null;
  departmentName?: string | null;
  phaseId: string | null;
  phaseName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: Assignee[];
  reactions: Reaction[];
  notes: Note[];
  milestones?: { id: string; title: string; status: string; dueDate: string | null }[];
  requirement?: TaskRequirement | null;
};

type SubmissionFile = {
  id: string;
  fileType: "IMAGE" | "VIDEO" | "DOCUMENT";
  fileName: string;
  filePath: string;
};

type Submission = {
  id: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  submittedBy: { user: { name: string | null; email: string } };
  reviewedBy: { user: { name: string | null } } | null;
  files: SubmissionFile[];
};

const EMOJI_OPTIONS = ["👍", "🔥", "✅", "❤️"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Pending",
  IN_PROGRESS: "Ongoing",
  DONE: "Completed",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes Requested",
  COMPLETED: "Completed",
};

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  TODO: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DONE: "bg-green-500/10 text-green-600 dark:text-green-400",
  SUBMITTED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  CHANGES_REQUESTED: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
};

// ─── main component ──────────────────────────────────────────────────────

export function Workspace({ planId }: { planId: string }) {
  const { currentPlanMeta } = useFinancialStore();
  const { show } = useSnackbar();

  const role = currentPlanMeta?.isOwner ? "OWNER" : (currentPlanMeta?.role ?? "MEMBER");
  const isAdminLevel = role === "OWNER" || role === "ADMIN" || role === "CO_ADMIN";
  const isManager = role === "MANAGER";
  const perms = getPermissions(currentPlanMeta);

  const [departments, setDepartments] = useState<DeptCard[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const [selectedDept, setSelectedDept] = useState<DeptCard | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // admin take-up
  const [view, setView] = useState<"departments" | "mine">("departments");
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [takeUpEnabled, setTakeUpEnabled] = useState(false);

  // Admin/Owner can always take up tasks; a co-admin only if the plan allows it
  const canTakeUpSelf =
    role === "OWNER" || role === "ADMIN" || (role === "CO_ADMIN" && takeUpEnabled);

  const fetchDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/my-work`);
      setDepartments(res.data.data.departments);
      setMyMemberId(res.data.data.memberId ?? null);
      setTakeUpEnabled(res.data.data.takeUpEnabled === true);
    } catch (err) {
      console.error("Failed to fetch my-work departments:", err);
    } finally {
      setLoadingDepts(false);
    }
  }, [planId]);

  const fetchTasks = useCallback(async (deptId: string) => {
    setLoadingTasks(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/my-work?departmentId=${deptId}`);
      setTasks(res.data.data.tasks);
    } catch (err) {
      console.error("Failed to fetch my-work tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const openDepartment = (dept: DeptCard) => {
    setSelectedDept(dept);
    fetchTasks(dept.id);
  };

  const backToDepartments = () => {
    setSelectedDept(null);
    setTasks([]);
    fetchDepartments(); // stats may have changed while inside
  };

  // Can this user leave notes/reactions on tasks in the currently open department?
  const canAnnotate = isAdminLevel || isManager;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdminLevel
            ? "Track tasks and progress across every department."
            : isManager
              ? "See what your teams are working on."
              : "See what's assigned to you."}
        </p>
      </div>

      {isAdminLevel && !selectedDept && (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          {([
            { key: "departments", label: "Departments" },
            { key: "mine", label: "My tasks" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {view === "mine" && isAdminLevel && !selectedDept ? (
        <MyTasksView
          planId={planId}
          memberId={myMemberId ?? undefined}
          perms={perms}
          canAnnotate={canAnnotate}
          takeUpEnabled={canTakeUpSelf}
          show={show}
        />
      ) : !selectedDept ? (
        <DepartmentGrid
          departments={departments}
          loading={loadingDepts}
          onOpen={openDepartment}
          planId={planId}
          perms={perms}
        />
      ) : (
        <DepartmentDetail
          dept={selectedDept}
          tasks={tasks}
          loading={loadingTasks}
          onBack={backToDepartments}
          planId={planId}
          role={role}
          canAnnotate={canAnnotate}
          isMember={role === "MEMBER"}
          perms={perms}
          memberId={myMemberId ?? currentPlanMeta?.memberId ?? undefined}
          isAdminLevel={isAdminLevel}
          takeUpEnabled={canTakeUpSelf}
          onTaskUpdated={(updated) =>
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          }
          onRefreshTasks={() => fetchTasks(selectedDept.id)}
          show={show}
        />
      )}
    </div>
  );
}

// ─── Department grid ─────────────────────────────────────────────────────

function MyTasksView({
  planId,
  memberId,
  perms,
  canAnnotate,
  takeUpEnabled,
  show,
}: {
  planId: string;
  memberId?: string;
  perms: PlanPermissions;
  canAnnotate: boolean;
  takeUpEnabled: boolean;
  show: (msg: string, type?: "success" | "error") => void;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED">("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const fetchMine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/my-work?mine=1`);
      setTasks(res.data.data.tasks);
    } catch (err) {
      console.error("Failed to fetch my tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const changeStatus = async (task: TaskItem, newStatus: TaskStatus) => {
    if (!task.departmentId) return;
    try {
      const res = await authClient.request(
        `/api/plan/${planId}/departments/${task.departmentId}/tasks/${task.id}`,
        { method: "PATCH", data: { status: newStatus } }
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: res.data.status, completedAt: res.data.completedAt ?? null } : t
        )
      );
      show("Task updated", "success");
    } catch (err) {
      console.error("Failed to update task status:", err);
      show("Failed to update task", "error");
    }
  };

  const deptOptions = Array.from(
    new Map(
      tasks.filter((t) => t.departmentId).map((t) => [t.departmentId as string, t.departmentName ?? "Department"])
    ).entries()
  );

  const matchesStatus = (t: TaskItem) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "COMPLETED") return t.status === "COMPLETED" || t.status === "DONE";
    if (statusFilter === "REVIEW") return t.status === "SUBMITTED" || t.status === "CHANGES_REQUESTED";
    return t.status === statusFilter;
  };

  const visible = tasks.filter(
    (t) => matchesStatus(t) && (deptFilter === "ALL" || t.departmentId === deptFilter)
  );

  const selectClass =
    "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground cursor-pointer";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="ALL">All statuses</option>
          <option value="TODO">Pending</option>
          <option value="IN_PROGRESS">Ongoing</option>
          <option value="REVIEW">In review / changes requested</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select className={selectClass} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="ALL">All departments</option>
          {deptOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your tasks...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {tasks.length === 0
            ? takeUpEnabled
              ? "You haven't taken up any tasks yet. Open a department and use \"Take up\" on a task."
              : "Tasks an admin assigns to you will show up here."
            : "No tasks match these filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((task) => (
            <div key={task.id} className="space-y-1">
              {task.departmentName && (
                <p className="px-1 text-xs font-medium text-muted-foreground">{task.departmentName}</p>
              )}
              <TaskCard
                task={task}
                planId={planId}
                deptId={task.departmentId ?? ""}
                canAnnotate={canAnnotate}
                isMember={false}
                canRequestExtension={false}
                canSubmitWork={perms.canSubmitTaskWork(true)}
                canApproveSubmission={perms.canApproveTaskSubmission(task.departmentId ?? "")}
                isAssignedToMe={task.assignees.some((a) => a.workItemMemberId === memberId)}
                canTakeUp={takeUpEnabled}
                canLeave
                milestoneDueDate={
                  task.milestones && task.milestones.length > 0
                    ? task.milestones
                        .map((m) => m.dueDate)
                        .filter((d): d is string => !!d)
                        .sort()[0]
                    : undefined
                }
                onRequestStatusChange={(s) => changeStatus(task, s)}
                onTaskUpdated={(updated) =>
                  setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
                }
                onWorkflowChanged={fetchMine}
                show={show}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentGrid({
  departments,
  loading,
  onOpen,
  planId,
  perms,
}: {
  departments: DeptCard[];
  loading: boolean;
  onOpen: (d: DeptCard) => void;
  planId: string;
  perms: PlanPermissions;
}) {
  const [viewRequestsFor, setViewRequestsFor] = useState<DeptCard | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    authClient
      .request(`/api/plan/${planId}/extension-requests/pending-counts`)
      .then((res) => setPendingCounts(res.data.data.byDepartment || {}))
      .catch((err) => console.error("Failed to fetch pending extension counts:", err));
  }, [planId, departments.length]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading departments...</p>;
  }

  if (departments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No departments to show yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((dept) => (
        <div key={dept.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{dept.name}</h3>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {dept.memberCount}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 py-2">
              <p className="text-lg font-bold text-foreground">{dept.taskStats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg bg-muted/40 py-2">
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{dept.taskStats.ongoing}</p>
              <p className="text-[10px] text-muted-foreground">Ongoing</p>
            </div>
            <div className="rounded-lg bg-muted/40 py-2">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{dept.taskStats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 cursor-pointer hover:text-gray-600" onClick={() => onOpen(dept)}>
              Open
            </Button>
            {perms.canViewExtensionRequests(dept.id) && (
              <Button
                size="sm"
                variant="secondary"
                className="relative px-3 cursor-pointer hover:text-gray-600"
                onClick={() => setViewRequestsFor(dept)}
              >
                <CalendarClock className="h-4 w-4" />
                {!!pendingCounts[dept.id] && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {pendingCounts[dept.id]}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      ))}

      {viewRequestsFor && (
        <DepartmentExtensionRequestsDialog
          planId={planId}
          deptId={viewRequestsFor.id}
          deptName={viewRequestsFor.name}
          open={!!viewRequestsFor}
          onOpenChange={(o) => !o && setViewRequestsFor(null)}
          canApprove={perms.canApproveExtensionRequests(viewRequestsFor.id)}
        />
      )}
    </div>
  );
}

// ─── Department detail ───────────────────────────────────────────────────

function DepartmentDetail({
  dept,
  tasks,
  loading,
  onBack,
  planId,
  role,
  canAnnotate,
  isMember,
  perms,
  memberId,
  isAdminLevel,
  takeUpEnabled,
  onTaskUpdated,
  onRefreshTasks,
  show,
}: {
  dept: DeptCard;
  tasks: TaskItem[];
  loading: boolean;
  onBack: () => void;
  planId: string;
  role: string;
  canAnnotate: boolean;
  isMember: boolean;
  perms: PlanPermissions;
  memberId?: string;
  isAdminLevel: boolean;
  takeUpEnabled: boolean;
  onTaskUpdated: (task: TaskItem) => void;
  onRefreshTasks: () => void;
  show: (msg: string, type?: "success" | "error") => void;
}) {
  const [statusChangeFor, setStatusChangeFor] = useState<{ task: TaskItem; newStatus: TaskStatus } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "mine">("all");

  const isAssignedToMe = (t: TaskItem) => t.assignees.some((a) => a.workItemMemberId === memberId);
  const visibleTasks = taskFilter === "mine" ? tasks.filter(isAssignedToMe) : tasks;

  const handleConfirmStatusChange = async () => {
    if (!statusChangeFor) return;
    setSubmitting(true);
    try {
      const res = await authClient.request(
        `/api/plan/${planId}/departments/${dept.id}/tasks/${statusChangeFor.task.id}`,
        { method: "PATCH", data: { status: statusChangeFor.newStatus } }
      );
      onTaskUpdated({ ...statusChangeFor.task, status: res.data.status, completedAt: res.data.completedAt ?? null });
      show("Task updated", "success");
      setStatusChangeFor(null);
    } catch (err) {
      console.error("Failed to update task status:", err);
      show("Failed to update task", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to departments
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dept.name}</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ListTodo className="h-3.5 w-3.5" /> {dept.taskStats.pending} pending</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {dept.taskStats.ongoing} ongoing</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {dept.taskStats.completed} completed</span>
        </div>
      </div>

      {isAdminLevel && (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          {([
            { key: "all", label: "All tasks" },
            { key: "mine", label: "My tasks" },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTaskFilter(f.key)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                taskFilter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tasks...</p>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {isMember
            ? "No tasks assigned to you here yet."
            : taskFilter === "mine"
              ? "You haven't taken up any tasks in this department."
              : "No tasks in this department yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              planId={planId}
              deptId={dept.id}
              canAnnotate={canAnnotate}
              isMember={isMember}
              canRequestExtension={perms.canRequestTaskExtension(dept.id, task.assignees.some(a => a.workItemMemberId === memberId))}
              canSubmitWork={perms.canSubmitTaskWork(task.assignees.some(a => a.workItemMemberId === memberId))}
              canApproveSubmission={perms.canApproveTaskSubmission(dept.id)}
              milestoneDueDate={
                task.milestones && task.milestones.length > 0
                  ? task.milestones
                    .map((m) => m.dueDate)
                    .filter((d): d is string => !!d)
                    .sort()[0] // earliest milestone due date
                  : undefined
              }
              onRequestStatusChange={(newStatus) => setStatusChangeFor({ task, newStatus })}
              isAssignedToMe={isAssignedToMe(task)}
              canTakeUp={isAdminLevel && takeUpEnabled}
              canLeave={isAdminLevel}
              onTaskUpdated={onTaskUpdated}
              onWorkflowChanged={onRefreshTasks}
              show={show}
            />
          ))}
        </div>
      )}

      <Dialog open={!!statusChangeFor} onOpenChange={(open) => { if (!open) setStatusChangeFor(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update task status</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mark <span className="font-medium text-foreground">"{statusChangeFor?.task.title}"</span> as{" "}
            <span className="font-medium text-foreground">
              {statusChangeFor && STATUS_LABEL[statusChangeFor.newStatus]}
            </span>?
          </p>
          <DialogFooter>
            <Button className="cursor-pointer hover:text-gray-600" variant="outline" onClick={() => setStatusChangeFor(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleConfirmStatusChange} disabled={submitting}>
              {submitting ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Task card ───────────────────────────────────────────────────────────

function TaskCard({
  task,
  planId,
  deptId,
  canAnnotate,
  isMember,
  canRequestExtension,
  canSubmitWork,
  canApproveSubmission,
  milestoneDueDate,
  onRequestStatusChange,
  isAssignedToMe,
  canTakeUp,
  canLeave,
  onTaskUpdated,
  onWorkflowChanged,
  show,
}: {
  task: TaskItem;
  planId: string;
  deptId: string;
  canAnnotate: boolean;
  isMember: boolean;
  canRequestExtension: boolean;
  canSubmitWork: boolean;
  canApproveSubmission: boolean;
  milestoneDueDate?: string;
  onRequestStatusChange: (status: TaskStatus) => void;
  isAssignedToMe: boolean;
  canTakeUp: boolean;
  canLeave: boolean;
  onTaskUpdated: (task: TaskItem) => void;
  onWorkflowChanged: () => void;
  show: (msg: string, type?: "success" | "error") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const isDone = task.status === "DONE" || task.status === "COMPLETED";
  const [takingUp, setTakingUp] = useState(false);

  const handleTakeUp = async (leave: boolean) => {
    setTakingUp(true);
    try {
      await authClient.request(
        `/api/plan/${planId}/departments/${deptId}/tasks/${task.id}/take-up`,
        { method: leave ? "DELETE" : "POST" }
      );
      show(leave ? "You left this task" : "You took up this task", "success");
      onWorkflowChanged();
    } catch (err: any) {
      show(err?.response?.data?.error || "Could not update your assignment", "error");
    } finally {
      setTakingUp(false);
    }
  };

  useEffect(() => {
    if (canApproveSubmission && task.status === "SUBMITTED") fetchSubmissions();
  }, [task.status]);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const res = await authClient.request(
        `/api/plan/${planId}/departments/${deptId}/tasks/${task.id}/submissions`
      );
      setSubmissions(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) fetchSubmissions();
  };

  const pendingSubmission = submissions.find((s) => s.status === "PENDING");

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/my-work/tasks/${task.id}/notes`, {
        method: "POST",
        data: { body: noteText.trim() },
      });
      onTaskUpdated({ ...task, notes: [res.data.data, ...task.notes] });
      setNoteText("");
      show("Note added", "success");
    } catch (err) {
      console.error("Failed to add note:", err);
      show("Failed to add note", "error");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleReact = async (emoji: string) => {
    try {
      const res = await authClient.request(`/api/plan/${planId}/my-work/tasks/${task.id}/reactions`, {
        method: "PUT",
        data: { emoji },
      });
      const withoutMine = task.reactions.filter((r) => r.authorId !== res.data.data.authorId);
      onTaskUpdated({ ...task, reactions: [...withoutMine, res.data.data] });
    } catch (err) {
      console.error("Failed to react:", err);
      show("Failed to react", "error");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE_CLASS[task.status])}>
              {STATUS_LABEL[task.status]}
            </span>
            {task.phaseName && (
              <span className="text-xs text-muted-foreground">Phase: {task.phaseName}</span>
            )}
            {!isMember && task.assignees.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Assigned: {task.assignees.map((a) => a.name ?? "Unnamed").join(", ")}
              </span>
            )}
            {task.dueDate && (
              <span className="text-xs text-muted-foreground">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {task.milestones && task.milestones.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {task.milestones.map((m) => {
                  const isOverdue =
                    m.dueDate &&
                    m.status !== "ACHIEVED" &&
                    new Date(m.dueDate) < new Date();
                  const statusDot =
                    m.status === "ACHIEVED"
                      ? "bg-green-500"
                      : m.status === "IN_PROGRESS"
                        ? "bg-yellow-500"
                        : m.status === "MISSED"
                          ? "bg-destructive"
                          : "bg-muted-foreground/40";
                  return (
                    <span
                      key={m.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                        isOverdue
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-border bg-muted/40 text-muted-foreground"
                      )}
                      title={`Milestone: ${m.title}${m.dueDate ? ` · Due ${new Date(m.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot)} />
                      <span className="max-w-[140px] truncate font-medium">{m.title}</span>
                      {m.dueDate && (
                        <span className="shrink-0 opacity-70">
                          · {new Date(m.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {task.status === "CHANGES_REQUESTED" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Changes requested — see history for reviewer's note
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-1 flex-wrap justify-end">
            {canRequestExtension && !isDone && (
              <RequestExtensionDialog
                planId={planId}
                targetType="TASK"
                targetId={task.id}
                itemLabel={task.title}
                currentDueDate={task.dueDate ?? undefined}
                maxDate={milestoneDueDate}
                trigger={
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs cursor-pointer">
                    Request Extension
                  </Button>
                }
              />
            )}
            {canTakeUp && !isAssignedToMe && !isDone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs cursor-pointer"
                disabled={takingUp}
                onClick={() => handleTakeUp(false)}
              >
                <UserPlus className="h-3 w-3" />
                Take up
              </Button>
            )}
            {canLeave && isAssignedToMe && !isDone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs cursor-pointer text-muted-foreground"
                disabled={takingUp}
                onClick={() => handleTakeUp(true)}
              >
                <UserMinus className="h-3 w-3" />
                Leave
              </Button>
            )}
            {task.status === "TODO" && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs cursor-pointer" onClick={() => onRequestStatusChange("IN_PROGRESS")}>
                Start
              </Button>
            )}

            {/* Submit / resubmit — assignee only, never a direct completion */}
            {canSubmitWork && (task.status === "IN_PROGRESS" || task.status === "CHANGES_REQUESTED") && (
              <SubmitWorkDialog
                planId={planId}
                deptId={deptId}
                taskId={task.id}
                taskTitle={task.title}
                requirement={task.requirement}
                isResubmit={task.status === "CHANGES_REQUESTED"}
                onSubmitted={onWorkflowChanged}
                trigger={
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs cursor-pointer text-green-600 hover:text-green-700 gap-1">
                    <Send className="h-3 w-3" />
                    {task.status === "CHANGES_REQUESTED" ? "Resubmit Work" : "Submit Work"}
                  </Button>
                }
              />
            )}

            {/* Review — approvers only, when there's something pending */}
            {canApproveSubmission && task.status === "SUBMITTED" && (
              pendingSubmission ? (
                <ReviewSubmissionDialog
                  planId={planId}
                  deptId={deptId}
                  taskId={task.id}
                  submission={pendingSubmission}
                  onReviewed={() => {
                    fetchSubmissions();
                    onWorkflowChanged();
                  }}
                  trigger={
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs cursor-pointer text-indigo-600 hover:text-indigo-700">
                      Review Submission
                    </Button>
                  }
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs cursor-pointer text-indigo-600 hover:text-indigo-700"
                  onClick={fetchSubmissions}
                >
                  Load Submission
                </Button>
              )
            )}
          </div>
          <div className="flex gap-1">
            {canAnnotate && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs cursor-pointer text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {task.notes.length > 0 ? `${task.notes.length} note${task.notes.length > 1 ? "s" : ""}` : "Notes"}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs cursor-pointer text-muted-foreground gap-1" onClick={toggleHistory}>
              <History className="h-3 w-3" />
              History
            </Button>
          </div>
        </div>
      </div>

      {/* reactions row — visible to everyone, editable only by those who can annotate */}
      {(task.reactions.length > 0 || canAnnotate) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.reactions.map((r) => (
            <span key={r.id} title={r.authorName ?? ""} className="rounded-full bg-muted/50 px-2 py-0.5 text-xs">
              {r.emoji}
            </span>
          ))}
          {canAnnotate && (
            <div className="flex gap-0.5 ml-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="rounded-full px-1.5 py-0.5 text-sm hover:bg-muted/60 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {expanded && canAnnotate && (
        <div className="space-y-2 pt-2 border-t border-border">
          {task.notes.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {task.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
                  <p className="text-foreground">{n.body}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {n.authorName ?? "Unknown"} · {new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Leave a note..."
              rows={1}
              className="resize-none text-xs"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" disabled={submittingNote || !noteText.trim()} onClick={handleAddNote}>
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Submission History */}
      {historyOpen && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">Submission History</p>
          {loadingSubmissions ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {s.submittedBy.user.name || s.submittedBy.user.email}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        s.status === "PENDING"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : s.status === "APPROVED"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</p>
                  {s.description && <p className="text-foreground">{s.description}</p>}
                  {s.files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.files.map((f) => (
                        <a
                          key={f.id}
                          href={f.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 hover:bg-muted/50"
                        >
                          {f.fileType === "IMAGE" ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : f.fileType === "VIDEO" ? (
                            <Video className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          {f.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                  {s.reviewComment && (
                    <p className="text-muted-foreground italic">"{s.reviewComment}"</p>
                  )}
                  {s.reviewedBy && (
                    <p className="text-muted-foreground">
                      Reviewed by {s.reviewedBy.user.name} on {s.reviewedAt && new Date(s.reviewedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}