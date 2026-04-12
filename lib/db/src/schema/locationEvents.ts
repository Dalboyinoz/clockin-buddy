import { pgTable, serial, timestamp, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationEventsTable = pgTable("location_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'arrival' | 'departure'
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocationEventSchema = createInsertSchema(locationEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLocationEvent = z.infer<typeof insertLocationEventSchema>;
export type LocationEvent = typeof locationEventsTable.$inferSelect;
