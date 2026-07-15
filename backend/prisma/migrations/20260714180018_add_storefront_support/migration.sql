-- AlterTable
ALTER TABLE `customers` ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `password` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `confirmed_at` DATETIME(3) NULL,
    ADD COLUMN `confirmed_by` INTEGER NULL,
    ADD COLUMN `proof_url` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE `po_details` ADD COLUMN `finishing_key` VARCHAR(191) NULL,
    ADD COLUMN `height_cm` DECIMAL(10, 2) NULL,
    ADD COLUMN `line_total` DECIMAL(14, 2) NULL,
    ADD COLUMN `material_key` VARCHAR(191) NULL,
    ADD COLUMN `need_design` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `unit_price` DECIMAL(14, 2) NULL,
    ADD COLUMN `width_cm` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `print_product_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `customers_email_key` ON `customers`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `products_print_product_id_key` ON `products`(`print_product_id`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_print_product_id_fkey` FOREIGN KEY (`print_product_id`) REFERENCES `print_products`(`print_product_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_confirmed_by_fkey` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

