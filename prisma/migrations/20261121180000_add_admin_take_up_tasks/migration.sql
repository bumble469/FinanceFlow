-- AlterTable: add allowAdminTakeUpTasks toggle to work_items
ALTER TABLE "work_items" ADD COLUMN "allowAdminTakeUpTasks" BOOLEAN NOT NULL DEFAULT false;
