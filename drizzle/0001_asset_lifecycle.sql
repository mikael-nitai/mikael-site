ALTER TABLE `site_content` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `content_assets` ADD `checksum_sha256` text;
--> statement-breakpoint
ALTER TABLE `content_assets` ADD `lifecycle_state` text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE `content_assets` ADD `linked_collection` text;
--> statement-breakpoint
ALTER TABLE `content_assets` ADD `linked_item_id` text;
--> statement-breakpoint
ALTER TABLE `content_assets` ADD `updated_at` text;
--> statement-breakpoint
WITH `asset_refs` (`id`, `collection`, `item_id`, `is_public`) AS (
  SELECT json_extract(`entry`.`value`, '$.coverAssetId'), 'projects', json_extract(`entry`.`value`, '$.id'),
    CASE WHEN json_extract(`entry`.`value`, '$.editorialStatus') = 'published' THEN 1 ELSE 0 END
  FROM `site_content`, json_each(CASE WHEN json_valid(`payload`) THEN `payload` ELSE '{}' END, '$.projects') AS `entry`
  WHERE json_type(`entry`.`value`, '$.coverAssetId') = 'text'
  UNION ALL
  SELECT json_extract(`entry`.`value`, '$.coverAssetId'), 'notes', json_extract(`entry`.`value`, '$.id'),
    CASE WHEN json_extract(`entry`.`value`, '$.editorialStatus') = 'published' THEN 1 ELSE 0 END
  FROM `site_content`, json_each(CASE WHEN json_valid(`payload`) THEN `payload` ELSE '{}' END, '$.notes') AS `entry`
  WHERE json_type(`entry`.`value`, '$.coverAssetId') = 'text'
  UNION ALL
  SELECT json_extract(`entry`.`value`, '$.coverAssetId'), 'learning', json_extract(`entry`.`value`, '$.id'),
    CASE WHEN json_extract(`entry`.`value`, '$.editorialStatus') = 'published' THEN 1 ELSE 0 END
  FROM `site_content`, json_each(CASE WHEN json_valid(`payload`) THEN `payload` ELSE '{}' END, '$.learning') AS `entry`
  WHERE json_type(`entry`.`value`, '$.coverAssetId') = 'text'
  UNION ALL
  SELECT json_extract(`entry`.`value`, '$.documentAssetId'), 'learning', json_extract(`entry`.`value`, '$.id'),
    CASE WHEN json_extract(`entry`.`value`, '$.editorialStatus') = 'published'
      AND json_type(`entry`.`value`, '$.documentPublic') = 'true' THEN 1 ELSE 0 END
  FROM `site_content`, json_each(CASE WHEN json_valid(`payload`) THEN `payload` ELSE '{}' END, '$.learning') AS `entry`
  WHERE json_type(`entry`.`value`, '$.documentAssetId') = 'text'
  UNION ALL
  SELECT json_extract(`entry`.`value`, '$.coverAssetId'), 'questions', json_extract(`entry`.`value`, '$.id'),
    CASE WHEN json_extract(`entry`.`value`, '$.editorialStatus') = 'published' THEN 1 ELSE 0 END
  FROM `site_content`, json_each(CASE WHEN json_valid(`payload`) THEN `payload` ELSE '{}' END, '$.questions') AS `entry`
  WHERE json_type(`entry`.`value`, '$.coverAssetId') = 'text'
)
UPDATE `content_assets`
SET `lifecycle_state` = 'linked',
  `linked_collection` = (SELECT `collection` FROM `asset_refs` WHERE `asset_refs`.`id` = `content_assets`.`id` LIMIT 1),
  `linked_item_id` = (SELECT `item_id` FROM `asset_refs` WHERE `asset_refs`.`id` = `content_assets`.`id` LIMIT 1),
  `is_public` = COALESCE((SELECT `is_public` FROM `asset_refs` WHERE `asset_refs`.`id` = `content_assets`.`id` LIMIT 1), 0),
  `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP)
WHERE EXISTS (SELECT 1 FROM `asset_refs` WHERE `asset_refs`.`id` = `content_assets`.`id`);
--> statement-breakpoint
UPDATE `content_assets`
SET `is_public` = 0,
  `lifecycle_state` = 'orphaned',
  `linked_collection` = NULL,
  `linked_item_id` = NULL,
  `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP)
WHERE `lifecycle_state` = 'pending';
--> statement-breakpoint
CREATE INDEX `content_assets_lifecycle_idx` ON `content_assets` (`lifecycle_state`);
--> statement-breakpoint
CREATE INDEX `content_assets_linked_item_idx` ON `content_assets` (`linked_collection`, `linked_item_id`);
