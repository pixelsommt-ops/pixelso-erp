-- CreateTable
CREATE TABLE `cash_accounts` (
  `cash_account_id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `bank_name` VARCHAR(191) NULL,
  `account_number` VARCHAR(191) NULL,
  `opening_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`cash_account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
  `expense_id` INTEGER NOT NULL AUTO_INCREMENT,
  `cash_account_id` INTEGER NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `expense_date` DATETIME(3) NOT NULL,
  `description` TEXT NULL,
  `created_by` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`expense_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
  `purchase_order_id` INTEGER NOT NULL AUTO_INCREMENT,
  `po_number` VARCHAR(191) NOT NULL,
  `supplier_id` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `order_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expected_date` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `cash_account_id` INTEGER NULL,
  `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_by` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `purchase_orders_po_number_key`(`po_number`),
  PRIMARY KEY (`purchase_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
  `purchase_order_item_id` INTEGER NOT NULL AUTO_INCREMENT,
  `purchase_order_id` INTEGER NOT NULL,
  `material_id` INTEGER NULL,
  `description` VARCHAR(191) NOT NULL,
  `qty` DECIMAL(14, 2) NOT NULL,
  `unit_price` DECIMAL(14, 2) NOT NULL,
  `line_total` DECIMAL(14, 2) NOT NULL,

  PRIMARY KEY (`purchase_order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
  `asset_id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NULL,
  `acquisition_date` DATETIME(3) NULL,
  `acquisition_cost` DECIMAL(14, 2) NULL,
  `current_value` DECIMAL(14, 2) NULL,
  `location` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`asset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_cash_account_id_fkey` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`cash_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_cash_account_id_fkey` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`cash_account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`purchase_order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`material_id`) ON DELETE SET NULL ON UPDATE CASCADE;
