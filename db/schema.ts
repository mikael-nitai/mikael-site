import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteContent = sqliteTable("site_content", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contentAssets = sqliteTable("content_assets", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  kind: text("kind", { enum: ["image", "document"] }).notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  checksumSha256: text("checksum_sha256"),
  altText: text("alt_text").notNull().default(""),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  lifecycleState: text("lifecycle_state", {
    enum: ["pending", "linked", "orphaned", "deleting"],
  }).notNull().default("pending"),
  linkedCollection: text("linked_collection"),
  linkedItemId: text("linked_item_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at"),
}, (table) => [
  index("content_assets_lifecycle_idx").on(table.lifecycleState),
  index("content_assets_linked_item_idx").on(table.linkedCollection, table.linkedItemId),
]);
