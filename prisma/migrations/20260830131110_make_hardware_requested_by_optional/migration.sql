-- DropForeignKey
ALTER TABLE "hardware_items" DROP CONSTRAINT "hardware_items_requestedById_fkey";

-- AlterTable
ALTER TABLE "hardware_items" ALTER COLUMN "requestedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "hardware_items" ADD CONSTRAINT "hardware_items_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "work_item_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
