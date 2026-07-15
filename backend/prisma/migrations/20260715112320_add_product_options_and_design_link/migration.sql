-- AlterTable
ALTER TABLE `po_details` ADD COLUMN `design_link` VARCHAR(191) NULL,
    ADD COLUMN `selected_options` JSON NULL;

-- CreateTable
CREATE TABLE `product_option_groups` (
    `group_id` INTEGER NOT NULL AUTO_INCREMENT,
    `print_product_id` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_option_choices` (
    `choice_id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `price_mode` VARCHAR(191) NOT NULL,
    `price_value` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `per_unit` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`choice_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_option_groups` ADD CONSTRAINT `product_option_groups_print_product_id_fkey` FOREIGN KEY (`print_product_id`) REFERENCES `print_products`(`print_product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_option_choices` ADD CONSTRAINT `product_option_choices_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `product_option_groups`(`group_id`) ON DELETE CASCADE ON UPDATE CASCADE;

