"use client";
import { useState, useEffect } from "react";
import { Department, Task, TaskRequirement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";
import { EventTaskListView } from "./event-task-list-view";
import { TaskDialog } from "./task-dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getPermissions } from "@/lib/permissions";

function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

export function EventDepartmentDetailView({
  dept,
  currency,
  onBack,
}: {
  dept: Department;
  currency: string;
  onBack: () => void;
}) {
  const { currentPlanId, currentPlanMeta } = useFinancialStore();
  const perms = getPermissions(currentPlanMeta);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; editing?: Task | null }>({ open: false });
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { fetchTasks(); }, [dept.id]);

  const fetchTasks = async () => {
    if (!currentPlanId) return;
    setLoading(true);
    try {
      const res = await authClient.request(`/api/plan/${currentPlanId}/departments/${dept.id}/tasks`);
      setTasks(res.data);
    } catch (err) {
      console.error("Fetch tasks failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (data: { title: string; description?: string; dueDate?: string; requirement: TaskRequirement }) => {
    if (!currentPlanId) return;
    const tempId = crypto.randomUUID();
    const optimistic: Task = {
      id: tempId,
      title: data.title,
      description: data.description,
      status: "TODO",
      priority: 0,
      phaseId: "",
      departmentId: dept.id,
      requirement: data.requirement,
    };
    setTasks((prev) => [...prev, optimistic]);
    try {
      const res = await authClient.request(`/api/plan/${currentPlanId}/departments/${dept.id}/tasks`, { method: "POST", data });
      setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: res.data.id } : t)));
    } catch (err) {
      console.error("Create task failed:", err);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const updateTask = async (id: string, data: Partial<{ title: string; description: string; dueDate: string; status: Task["status"]; requirement: TaskRequirement }>) => {
    if (!currentPlanId) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try {
      await authClient.request(`/api/plan/${currentPlanId}/departments/${dept.id}/tasks/${id}`, { method: "PATCH", data });
    } catch (err) {
      console.error("Update task failed:", err);
    }
  };

  const deleteTask = async (id: string) => {
    if (!currentPlanId) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await authClient.request(`/api/plan/${currentPlanId}/departments/${dept.id}/tasks/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Delete task failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={onBack} className="hover:bg-muted/40 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Departments</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{dept.name}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="text-sm font-mono font-medium text-foreground">{formatCurrency(dept.budget || 0, currency)}</p>
        </div>
      </div>

      {perms.canAddTask(dept.id) && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 border-dashed hover:bg-muted/40 hover:text-foreground hover:border-muted transition-colors cursor-pointer"
          onClick={() => setTaskDialog({ open: true })}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading tasks...</div>
      ) : (
        <EventTaskListView
          tasks={tasks}
          workItemId={currentPlanId!}
          deptId={dept.id}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onEdit={(task) => setTaskDialog({ open: true, editing: task })}
          onDelete={(id) => { setDeleteTaskId(id); setConfirmOpen(true); }}
          canApproveSubmissions={perms.canApproveTaskSubmission(dept.id)}
          onSubmissionReviewed={fetchTasks}
          canEdit={perms.canEditTask(dept.id)}
          canDelete={perms.canDeleteTask}
        />
      )}

      <TaskDialog
        open={taskDialog.open}
        editingTask={taskDialog.editing}
        onClose={() => setTaskDialog({ open: false })}
        onSave={(data) => {
          if (taskDialog.editing) updateTask(taskDialog.editing.id, data);
          else createTask(data);
          setTaskDialog({ open: false });
        }}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        type={"task"}
        setOpen={setConfirmOpen}
        onConfirm={() => { if (deleteTaskId) { deleteTask(deleteTaskId); setDeleteTaskId(null); } }}
      />
    </div>
  );
}