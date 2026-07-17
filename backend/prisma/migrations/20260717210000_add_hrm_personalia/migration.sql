-- CreateTable
CREATE TABLE `positions` (
  `position_id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `parent_id` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`position_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employment_contracts` (
  `contract_id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `contract_type` VARCHAR(191) NOT NULL,
  `start_date` DATETIME(3) NOT NULL,
  `end_date` DATETIME(3) NULL,
  `base_salary` DECIMAL(14, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`contract_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
  `shift_id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `start_time` VARCHAR(191) NOT NULL,
  `end_time` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`shift_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_assignments` (
  `assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `shift_id` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `shift_assignments_user_id_date_key`(`user_id`, `date`),
  PRIMARY KEY (`assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
  `attendance_id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `check_in_at` DATETIME(3) NULL,
  `check_out_at` DATETIME(3) NULL,
  `check_in_lat` DECIMAL(10, 7) NULL,
  `check_in_lng` DECIMAL(10, 7) NULL,
  `check_out_lat` DECIMAL(10, 7) NULL,
  `check_out_lng` DECIMAL(10, 7) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'present',
  `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
  `notes` TEXT NULL,

  UNIQUE INDEX `attendances_user_id_date_key`(`user_id`, `date`),
  PRIMARY KEY (`attendance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `position_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `positions_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `positions`(`position_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_assignments` ADD CONSTRAINT `shift_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_assignments` ADD CONSTRAINT `shift_assignments_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`shift_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`position_id`) ON DELETE SET NULL ON UPDATE CASCADE;
