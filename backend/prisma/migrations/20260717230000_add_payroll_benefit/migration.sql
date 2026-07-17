-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `marital_status` VARCHAR(191) NOT NULL DEFAULT 'TK',
  ADD COLUMN `dependents_count` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `payroll_runs` (
  `payroll_run_id` INTEGER NOT NULL AUTO_INCREMENT,
  `period` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `created_by` INTEGER NOT NULL,
  `finalized_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `payroll_runs_period_key`(`period`),
  PRIMARY KEY (`payroll_run_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_items` (
  `payroll_item_id` INTEGER NOT NULL AUTO_INCREMENT,
  `payroll_run_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `base_salary` DECIMAL(14, 2) NOT NULL,
  `overtime_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  `overtime_pay` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `incentive` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `gross_pay` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `pph21` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bpjs_kesehatan_employee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bpjs_ketenagakerjaan_employee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `total_deductions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `net_pay` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bpjs_kesehatan_employer` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bpjs_ketenagakerjaan_employer` DECIMAL(14, 2) NOT NULL DEFAULT 0,

  UNIQUE INDEX `payroll_items_payroll_run_id_user_id_key`(`payroll_run_id`, `user_id`),
  PRIMARY KEY (`payroll_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`payroll_run_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
