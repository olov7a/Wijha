import { z } from "zod";

const AMENITY_KEYS = [
  "wifi",
  "ac",
  "laundry",
  "gas",
  "elevator",
  "desk",
  "security",
] as const;

const bedSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    // Whole EGP as entered by the owner; the action converts to piastres.
    price: z.number().int().min(1).max(1_000_000),
  })
  .strict();

const roomSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    beds: z.array(bedSchema).min(1).max(12),
  })
  .strict();

export const createUnitSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    area: z.string().trim().min(2).max(120),
    gender: z.enum(["male", "female"]),
    description: z.string().trim().max(3000).optional(),
    amenities: z.array(z.enum(AMENITY_KEYS)).max(30),
    rooms: z.array(roomSchema).min(1).max(20),
  })
  .strict()
  .refine((value) => new Set(value.rooms.map((room) => room.name)).size === value.rooms.length, {
    message: "Room names must be unique",
    path: ["rooms"],
  });

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitStatusSchema = z
  .object({
    unitId: z.uuid(),
    status: z.enum(["approved", "rejected", "pending"]),
  })
  .strict();

export type UpdateUnitStatusInput = z.infer<typeof updateUnitStatusSchema>;
