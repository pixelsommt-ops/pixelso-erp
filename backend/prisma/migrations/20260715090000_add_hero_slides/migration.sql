-- AlterTable
ALTER TABLE `site_settings` ADD COLUMN `hero_slides` JSON NULL;

-- Backfill: foto hero lama (satu foto, tanpa link) jadi slide pertama supaya tidak hilang.
UPDATE `site_settings` SET `hero_slides` = JSON_ARRAY(JSON_OBJECT('url', `hero_image_url`, 'linkUrl', NULL))
  WHERE `hero_image_url` IS NOT NULL;
