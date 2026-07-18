-- CreateTable
CREATE TABLE `work_links` (
    `link_id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(2048) NOT NULL,
    `title` VARCHAR(191) NULL,
    `thumbnail_url` VARCHAR(2048) NULL,
    `platform` VARCHAR(191) NOT NULL DEFAULT 'web',
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`link_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_link_clicks` (
    `click_id` INTEGER NOT NULL AUTO_INCREMENT,
    `link_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `clicked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`click_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_links` ADD CONSTRAINT `work_links_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_link_clicks` ADD CONSTRAINT `work_link_clicks_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `work_links`(`link_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_link_clicks` ADD CONSTRAINT `work_link_clicks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
