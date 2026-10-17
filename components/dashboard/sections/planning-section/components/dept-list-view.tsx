// components/department-list-view.tsx
import { Department } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";

function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

export function DepartmentListView({
  departments,
  currency,
  onEdit,
  onDelete,
  onDrillDown,
  isProject,
  canEdit,
  canDelete,
}: {
  departments: Department[];
  currency: string;
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
  onDrillDown: (dept: Department) => void;
  isProject: boolean;
  canEdit?: (deptId: string) => boolean;
  canDelete?: boolean;
}) {
  return (
    <div className="space-y-3">
      {departments.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-8">
          No departments yet — add one above.
        </p>
      )}
      {departments.map((d) => (
        <div
          key={d.id}
          className="group rounded-xl border bg-card p-4 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{d.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(d.budget || 0, currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(canEdit?.(d.id) || canDelete) && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  {canEdit?.(d.id) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(d)}
                      className="cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(d.id)}
                      className="cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="ml-2 gap-1.5 text-xs hover:bg-muted/40 hover:text-muted-foreground cursor-pointer hover:border-muted"
                onClick={() => onDrillDown(d)}
              >
                View
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}