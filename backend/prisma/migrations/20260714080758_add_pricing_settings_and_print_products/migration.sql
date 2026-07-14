-- CreateTable
CREATE TABLE `pricing_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `design_fee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `material_factors` JSON NOT NULL,
    `finishing_rates` JSON NOT NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `print_products` (
    `print_product_id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pricing_mode` VARCHAR(191) NOT NULL,
    `base_rate` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `minimum_area` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `setup_fee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `print_products_key_key`(`key`),
    PRIMARY KEY (`print_product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
