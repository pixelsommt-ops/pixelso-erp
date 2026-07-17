-- AlterTable
ALTER TABLE `po_details` ADD COLUMN `material_id` INTEGER NULL, ADD COLUMN `material_qty` DECIMAL(14, 2) NULL;

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `po_detail_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `po_details` ADD CONSTRAINT `po_details_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`material_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_po_detail_id_fkey` FOREIGN KEY (`po_detail_id`) REFERENCES `po_details`(`po_detail_id`) ON DELETE SET NULL ON UPDATE CASCADE;
