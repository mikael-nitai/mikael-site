import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteContent = sqliteTable("site_content", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
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
  altText: text("alt_text").notNull().default(""),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
