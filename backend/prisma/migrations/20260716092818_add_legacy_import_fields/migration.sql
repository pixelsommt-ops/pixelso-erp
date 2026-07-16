-- AlterTable
ALTER TABLE `customers` ADD COLUMN `legacy_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `legacy_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `suppliers` (
    `supplier_id` INTEGER NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `contact` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `suppliers_legacy_id_key`(`legacy_id`),
    PRIMARY KEY (`supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `customers_legacy_id_key` ON `customers`(`legacy_id`);

-- CreateIndex
CREATE UNIQUE INDEX `products_legacy_id_key` ON `products`(`legacy_id`);
