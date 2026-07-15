-- AlterTable
ALTER TABLE `print_products` ADD COLUMN `images` JSON NULL,
    ADD COLUMN `video_url` VARCHAR(191) NULL;

-- Backfill: produk yang sudah punya image_url pindahkan jadi elemen pertama di images
-- supaya foto yang sudah ada tidak hilang dan otomatis jadi thumbnail utama.
UPDATE `print_products` SET `images` = JSON_ARRAY(`image_url`) WHERE `image_url` IS NOT NULL;
