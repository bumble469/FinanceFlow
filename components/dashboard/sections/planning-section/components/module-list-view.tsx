import { Module } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight, Layers } from "lucide-react";

export function ModuleListView({
  modules,
  onEdit,
  onDelete,
  onDrillDown,
  canEdit,
  canDelete,
}: {
  modules: Module[];
  onEdit: (module: Module) => void;
  onDelete: (id: string) => void;
  onDrillDown: (module: Module) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed">
        <Layers className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No modules yet</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Add a module to break this department into phases
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((m) => (
        <div
          key={m.id}
          className="group flex items-center justify-between rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <p className="font-medium text-sm text-foreground truncate">{m.name}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(m)}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(m.id)}
                    className="cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="ml-2 gap-1.5 text-xs hover:bg-muted/40 hover:text-muted-foreground cursor-pointer hover:border-muted"
              onClick={() => onDrillDown(m)}
            >
              View
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}