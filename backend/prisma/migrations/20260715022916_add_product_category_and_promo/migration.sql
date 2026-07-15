-- AlterTable
ALTER TABLE `print_products` ADD COLUMN `category` VARCHAR(191) NULL;

-- Backfill kategori untuk 7 produk yang sudah ada (seed.js upsert tidak menyentuh row lama)
UPDATE `print_products` SET `category` = 'Banner & Spanduk' WHERE `key` = 'banner';
UPDATE `print_products` SET `category` = 'Stiker' WHERE `key` = 'sticker';
UPDATE `print_products` SET `category` = 'Apparel & DTF' WHERE `key` = 'dtf';
UPDATE `print_products` SET `category` = 'Cetak Dokumen' WHERE `key` = 'a3';
UPDATE `print_products` SET `category` = 'Laser Cutting' WHERE `key` = 'laser';
UPDATE `print_products` SET `category` = 'Merchandise' WHERE `key` = 'lanyard';
UPDATE `print_products` SET `category` = 'Merchandise' WHERE `key` = 'mug';

-- CreateTable
CREATE TABLE `promos` (
    `promo_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(191) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`promo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
