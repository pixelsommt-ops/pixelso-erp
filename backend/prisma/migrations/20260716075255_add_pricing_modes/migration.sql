-- CreateTable
CREATE TABLE `pricing_modes` (
    `mode_id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `calc_type` VARCHAR(191) NOT NULL DEFAULT 'scalar',
    `unit_label` VARCHAR(191) NOT NULL,
    `input_label` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `pricing_modes_key_key`(`key`),
    PRIMARY KEY (`mode_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
