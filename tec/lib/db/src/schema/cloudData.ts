import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const cloudMachinesTable = pgTable("cloud_machines", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  model:        text("model").notNull(),
  brand:        text("brand").notNull(),
  year:         integer("year").notNull(),
  serialNumber: text("serial_number").notNull(),
  fleetNumber:  text("fleet_number").notNull().default(""),
  createdAt:    timestamp("created_at").notNull(),
  updatedAt:    timestamp("updated_at").notNull(),
});

export const cloudOperatorsTable = pgTable("cloud_operators", {
  id:          text("id").primaryKey(),
  userId:      text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  birthDate:   text("birth_date").notNull(),
  payment:     text("payment").notNull(),
  weeklyHours: text("weekly_hours").notNull(),
  createdAt:   timestamp("created_at").notNull(),
  updatedAt:   timestamp("updated_at").notNull(),
});

export const cloudRentalsTable = pgTable("cloud_rentals", {
  id:              text("id").primaryKey(),
  userId:          text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clientName:      text("client_name").notNull(),
  description:     text("description"),
  startDate:       text("start_date").notNull(),
  endDate:         text("end_date").notNull(),
  machineRevenues: jsonb("machine_revenues").notNull().$type<any[]>(),
  createdAt:       timestamp("created_at").notNull(),
});

export type CloudMachine  = typeof cloudMachinesTable.$inferSelect;
export type CloudOperator = typeof cloudOperatorsTable.$inferSelect;
export type CloudRental   = typeof cloudRentalsTable.$inferSelect;
