-- CreateTable
CREATE TABLE `themes` (
  `theme_id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  `colors` JSON NULL,
  `logo_url` VARCHAR(191) NULL,
  `hero_slides` JSON NULL,
  `custom_css` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`theme_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
