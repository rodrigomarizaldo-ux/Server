import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id:                   text("id").primaryKey(),
  username:             text("username").notNull().unique(),
  passwordHash:         text("password_hash").notNull(),
  stripeCustomerId:     text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export type User         = typeof usersTable.$inferSelect;
export type InsertUser   = typeof usersTable.$inferInsert;
