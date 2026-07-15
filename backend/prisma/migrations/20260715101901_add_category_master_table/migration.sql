-- CreateTable
CREATE TABLE `categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categories_name_key`(`name`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed 6 kategori yang sudah dipakai PrintProduct sejak migrasi kemarin
INSERT INTO `categories` (`name`) VALUES
  ('Banner & Spanduk'),
  ('Stiker'),
  ('Apparel & DTF'),
  ('Cetak Dokumen'),
  ('Laser Cutting'),
  ('Merchandise');

-- AlterTable: tambah kolom baru dulu, kolom lama dibiarkan sementara untuk backfill
ALTER TABLE `print_products` ADD COLUMN `category_id` INTEGER NULL;
ALTER TABLE `products` ADD COLUMN `category_id` INTEGER NULL;

-- Backfill print_products.category_id dari nilai string category lama (exact match nama)
UPDATE `print_products` pp
JOIN `categories` c ON pp.`category` = c.`name`
SET pp.`category_id` = c.`category_id`;

-- Backfill products.category_id: produk yang terhubung ke storefront ikut kategori
-- PrintProduct-nya (bukan string 'storefront' yang cuma penanda, tidak berarti apa-apa)
UPDATE `products` p
JOIN `print_products` pp ON p.`print_product_id` = pp.`print_product_id`
SET p.`category_id` = pp.`category_id`
WHERE p.`print_product_id` IS NOT NULL;

-- Backfill products.category_id untuk produk manual (tanpa link storefront): exact match nama
UPDATE `products` p
JOIN `categories` c ON p.`category` = c.`name`
SET p.`category_id` = c.`category_id`
WHERE p.`print_product_id` IS NULL;

-- Sekarang aman drop kolom string lama
ALTER TABLE `print_products` DROP COLUMN `category`;
ALTER TABLE `products` DROP COLUMN `category`;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_products` ADD CONSTRAINT `print_products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;
