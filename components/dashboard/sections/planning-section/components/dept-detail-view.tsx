"use client";
import { useState } from "react";
import { Department, Module } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";
import { ModuleListView } from "./module-list-view";
import { ModuleDetailView } from "./module-detail-view";
import { ModuleDialog } from "./module-dialog";

function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

export function DepartmentDetailView({
  dept,
  modules,
  currency,
  onBack,
  onAddModule,
  onEditModule,
  onDeleteModule,
  canAddModule,
  canEditModule,
  canDeleteModule,
  canAddTask,
  canEditTask,
  canDeleteTask,
  canApproveTaskSubmissions,
}: {
  dept: Department;
  modules: Module[];
  currency: string;
  onBack: () => void;
  onAddModule: (name: string) => void;
  onEditModule: (module: Module, name: string) => void;
  onDeleteModule: (id: string) => void;
  canAddModule?: boolean;
  canEditModule?: boolean;
  canDeleteModule?: boolean;
  canAddTask?: boolean;
  canEditTask?: boolean;
  canDeleteTask?: boolean;
  canApproveTaskSubmissions?: boolean;
}) {
  const deptModules = modules.filter((m) => m.departmentId === dept.id);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [moduleDialog, setModuleDialog] = useState<{
    open: boolean;
    editing?: Module | null;
  }>({ open: false });

  // ── Header ───────────────────────────────────
  const Header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={activeModule ? () => setActiveModule(null) : onBack}
          className="hover:bg-muted/40 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Departments</span>
          <ChevronRight className="h-3.5 w-3.5" />
          {activeModule ? (
            <>
              <span>{dept.name}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{activeModule.name}</span>
            </>
          ) : (
            <span className="text-foreground font-medium">{dept.name}</span>
          )}
        </div>
      </div>

      {!activeModule && (
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="text-sm font-mono font-medium text-foreground">
            {formatCurrency(dept.budget || 0, currency)}
          </p>
        </div>
      )}
    </div>
  );

  // ── Module Detail View ───────────────────────
  if (activeModule) {
    return (
      <div className="space-y-4">
        {Header}
        <ModuleDetailView
          module={activeModule}
          onBack={() => setActiveModule(null)}
          canAddTask={canAddTask}
          canEditTask={canEditTask}
          canDeleteTask={canDeleteTask}
          canApproveTaskSubmissions={canApproveTaskSubmissions}
        />
      </div>
    );
  }

  // ── Main View ───────────────────────────────
  return (
    <div className="space-y-4">
      {Header}

      {canAddModule && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 border-dashed hover:bg-muted/40 hover:text-foreground hover:border-muted transition-colors cursor-pointer"
          onClick={() => setModuleDialog({ open: true })}
        >
          <Plus className="h-4 w-4" />
          Add Module
        </Button>
      )}

      <ModuleListView
        modules={deptModules}
        onEdit={(m) => setModuleDialog({ open: true, editing: m })}
        onDelete={(id) => onDeleteModule(id)}
        onDrillDown={(m) => setActiveModule(m)}
        canEdit={canEditModule}
        canDelete={canDeleteModule}
      />

      <ModuleDialog
        open={moduleDialog.open}
        editingModule={moduleDialog.editing}
        onClose={() => setModuleDialog({ open: false })}
        onSave={(name) => {
          if (moduleDialog.editing) {
            onEditModule(moduleDialog.editing, name);
          } else {
            onAddModule(name);
          }
          setModuleDialog({ open: false });
        }}
      />
    </div>
  );
}