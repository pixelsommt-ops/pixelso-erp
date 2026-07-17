-- AlterTable
ALTER TABLE `customers`
  ADD COLUMN `google_id` VARCHAR(191) NULL,
  ADD COLUMN `reset_token_hash` VARCHAR(191) NULL,
  ADD COLUMN `reset_token_expires_at` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `customers_google_id_key` ON `customers`(`google_id`);
