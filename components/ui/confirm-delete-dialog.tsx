"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  type: string;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
};

export function ConfirmDeleteDialog({
  open,
  type,
  setOpen,
  onConfirm,
  title = `Delete ${type}`,
  description = `Are you sure you want to delete this ${type}? This action cannot be undone.`,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        {/* HEADER */}
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* FOOTER */}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)} className="cursor-pointer hover:text-muted-foreground">
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            className="bg-red-600 hover:bg-red-800 text-foreground cursor-pointer"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}