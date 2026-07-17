-- AlterTable
ALTER TABLE `products`
  ADD COLUMN `pricing_mode` VARCHAR(191) NOT NULL DEFAULT 'unit';
