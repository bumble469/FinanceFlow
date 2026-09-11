"use client";
import { useState, useEffect } from "react";
import { Module, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { TaskListView } from "./task-list-view";
import { TaskDialog } from "./task-dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";

export function ModuleDetailView({
  module,
  onBack,
  canAddTask,
  canEditTask,
  canDeleteTask,
  canApproveTaskSubmissions,
}: {
  module: Module;
  onBack: () => void;
  canAddTask?: boolean;
  canEditTask?: boolean;
  canDeleteTask?: boolean;
  canApproveTaskSubmissions?: boolean;
}) {
  const { currentPlanId } = useFinancialStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    editing?: Task | null;
  }>({ open: false });

  // Delete confirm
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
    console.log("module: ", module);
  }, [module.id]);

  const fetchTasks = async () => {
    if (!currentPlanId) return;
    setLoading(true);
    try {
      const res = await authClient.request(
        `/api/plan/${currentPlanId}/departments/${module.departmentId}/phases/${module.id}/tasks`
      );
      setTasks(res.data);
    } catch (err) {
      console.error("Fetch tasks failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (data: { title: string; description?: string; dueDate?: string }) => {
    if (!currentPlanId) return;
    const tempId = crypto.randomUUID();
    const optimistic: Task = {
      id: tempId,
      title: data.title,
      description: data.description,
      status: "TODO",
      priority: 0,
      phaseId: module.id,
      departmentId: module.departmentId,
      dueDate: data.dueDate,
    };
    setTasks((prev) => [...prev, optimistic]);
    try {
      const res = await authClient.request(
        `/api/plan/${currentPlanId}/departments/${module.departmentId}/phases/${module.id}/tasks`,
        { method: "POST", data }
      );
      // Swap temp id for real one
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, id: res.data.id } : t))
      );
    } catch (err) {
      console.error("Create task failed:", err);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const updateTask = async (
    id: string,
    data: Partial<{ title: string; description: string; dueDate: string; status: Task["status"] }>
  ) => {
    if (!currentPlanId) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try {
      await authClient.request(
        `/api/plan/${currentPlanId}/departments/${module.departmentId}/phases/${module.id}/tasks/${id}`,
        { method: "PATCH", data }
      );
    } catch (err) {
      console.error("Update task failed:", err);
    }
  };

  const deleteTask = async (id: string) => {
    if (!currentPlanId) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await authClient.request(
        `/api/plan/${currentPlanId}/departments/${module.departmentId}/phases/${module.id}/tasks/${id}`,
        { method: "DELETE" }
      );
    } catch (err) {
      console.error("Delete task failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          className="shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Module</p>
          <h2 className="font-semibold text-foreground truncate">{module.name}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Tasks</p>
          <p className="text-sm font-mono font-medium text-foreground">
            {tasks.filter((t) => t.status === "DONE").length}/{tasks.length}
          </p>
        </div>
      </div>

      {/* Add task button */}
      {canAddTask && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 border-dashed cursor-pointer hover:text-gray-400"
          onClick={() => setTaskDialog({ open: true })}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      )}

      {/* Task list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading tasks...
        </div>
      ) : (
        <TaskListView
          tasks={tasks}
          workItemId={currentPlanId!}
          deptId={module.departmentId!}
          phaseId={module.id}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onEdit={(task) => setTaskDialog({ open: true, editing: task })}
          onDelete={(id) => {
            setDeleteTaskId(id);
            setConfirmOpen(true);
          }}
          canEdit={canEditTask}
          canDelete={canDeleteTask}
          canApproveSubmissions={canApproveTaskSubmissions}
          onSubmissionReviewed={fetchTasks}
        />
      )}

      {/* Task dialog */}
      <TaskDialog
        open={taskDialog.open}
        editingTask={taskDialog.editing}
        onClose={() => setTaskDialog({ open: false })}
        onSave={(data) => {
          if (taskDialog.editing) {
            updateTask(taskDialog.editing.id, data);
          } else {
            createTask(data);
          }
          setTaskDialog({ open: false });
        }}
      />

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={confirmOpen}
        type={"task"}
        setOpen={setConfirmOpen}
        onConfirm={() => {
          if (deleteTaskId) {
            deleteTask(deleteTaskId);
            setDeleteTaskId(null);
          }
        }}
      />
    </div>
  );
}