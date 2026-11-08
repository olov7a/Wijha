import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import {
  getSampleUnit,
  sampleUnits,
  type AmenityKey,
  type LocalizedText,
  type SampleUnit,
} from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/server";
import type { UnitListing } from "@/types/database.types";

export type UnitBedView = {
  id: string;
  label: string;
  price: number;
  status: "available" | "held" | "booked";
};

export type UnitRoomView = {
  id: string;
  name: string;
  beds: UnitBedView[];
};

export type UnitView = SampleUnit & {
  rooms: UnitRoomView[];
  photoUrls: string[];
  isLive: boolean;
};

const KNOWN_AMENITIES: readonly AmenityKey[] = [
  "wifi",
  "ac",
  "laundry",
  "gas",
  "elevator",
  "desk",
  "security",
];

const TONES: readonly SampleUnit["imageTone"][] = [
  "mint",
  "sand",
  "rose",
  "sky",
  "olive",
  "clay",
  "teal",
  "amber",
];

/** Missing-table errors mean the migrations are not applied yet. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function toneFor(id: string): SampleUnit["imageTone"] {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

/** The database stores one language; the UI still needs both slots. */
function toLocalized(value: string | null | undefined, fallback: LocalizedText): LocalizedText {
  const text = value?.trim();
  return text ? { ar: text, en: text } : fallback;
}

function toAmenityKeys(values: string[]): AmenityKey[] {
  return values.filter((value): value is AmenityKey =>
    (KNOWN_AMENITIES as readonly string[]).includes(value),
  );
}

type UnitListingFields = Pick<
  UnitListing,
  | "id"
  | "owner_id"
  | "title"
  | "area"
  | "gender_type"
  | "description"
  | "amenities"
  | "status"
  | "rating"
  | "review_count"
  | "available_beds"
  | "total_beds"
  | "min_price_piastres"
>;

function toUnitView(row: UnitListingFields): UnitView {
  const title = toLocalized(row.title, { ar: "سكن طلابي", en: "Student housing" });
  const area = toLocalized(row.area, { ar: "القاهرة", en: "Cairo" });

  return {
    id: row.id,
    name: title,
    area,
    address: area,
    description: toLocalized(row.description, {
      ar: "بيانات الوحدة لسه بتتكمل.",
      en: "This unit's details are being completed.",
    }),
    price: Math.round(row.min_price_piastres / 100),
    gender: row.gender_type,
    rating: Number(row.rating),
    reviews: row.review_count,
    availableBeds: row.available_beds,
    totalBeds: row.total_beds,
    roomType: "shared",
    roomTypeLabel: { ar: "غرفة مشتركة", en: "Shared room" },
    distance: { ar: "", en: "" },
    amenities: toAmenityKeys(row.amenities),
    tags: [],
    owner: { ar: "مالك الوحدة", en: "Unit owner" },
    ownerResponse: 0,
    matchScore: undefined,
    instant: false,
    inspection: true,
    imageTone: toneFor(row.id),
    rooms: [],
    photoUrls: [],
    isLive: row.status === "approved",
  };
}

async function loadPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unitId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.from("unit-photos").list(unitId, {
      limit: 6,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) return [];

    return data
      .filter((file) => Boolean(file.name) && !file.name.endsWith("/"))
      .map((file) => supabase.storage.from("unit-photos").getPublicUrl(`${unitId}/${file.name}`).data.publicUrl);
  } catch {
    return [];
  }
}

/**
 * Approved listings for the storefront. Before the migrations run the view does
 * not exist, so the curated sample set keeps the UI usable; once it does, the
 * sample set is dropped automatically.
 */
export async function getUnitListings(): Promise<SampleUnit[]> {
  if (!isSupabaseConfigured()) return sampleUnits;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_listings")
    .select(
      "id, owner_id, title, area, gender_type, description, amenities, status, rating, review_count, available_beds, total_beds, min_price_piastres, created_at",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingSchema(error)) console.error("getUnitListings failed", error);
    return sampleUnits;
  }

  const listings = (data ?? []).map((row) => toUnitView(row));

  // Signed-in students also get their personalised score on the explore cards.
  // Anonymous callers simply get zero rows from the RPC (it joins the profile).
  const { data: matches, error: matchError } = await supabase.rpc("match_units", { p_limit: 50 });

  if (matchError) {
    if (!["42P01", "PGRST202", "PGRST205"].includes(matchError.code ?? "")) {
      console.error("getUnitListings match_units failed", matchError);
    }
    return listings;
  }

  if (!matches || matches.length === 0) return listings;

  const scores = new Map(matches.map((row) => [row.unit_id, Math.round(Number(row.score) * 100)]));
  return listings.map((unit) => ({ ...unit, matchScore: scores.get(unit.id) }));
}

/** One listing plus its rooms and beds, for the detail and booking pages. */
export async function getUnitView(id: string): Promise<UnitView | null> {
  if (!isSupabaseConfigured()) return fromSample(id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (!isMissingSchema(error)) console.error("getUnitView failed", error);
    return fromSample(id);
  }

  if (!data) {
    // A stale sample link still resolves while the real catalogue is being
    // filled, instead of turning into a 404 overnight.
    return fromSample(id);
  }

  const unit = toUnitView(data);

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("unit_id", id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (roomsError) console.error("getUnitView rooms failed", roomsError);

  const roomIds = (rooms ?? []).map((room) => room.id);

  let beds: {
    id: string;
    room_id: string;
    label: string;
    price_piastres: number;
    status: UnitBedView["status"];
  }[] = [];

  if (roomIds.length) {
    const result = await supabase
      .from("beds")
      .select("id, room_id, label, price_piastres, status")
      .in("room_id", roomIds)
      .is("deleted_at", null)
      .order("label", { ascending: true });

    if (result.error) console.error("getUnitView beds failed", result.error);
    beds = result.data ?? [];
  }

  const unitRooms: UnitRoomView[] = (rooms ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    beds: beds
      .filter((bed) => bed.room_id === room.id)
      .map((bed) => ({
        id: bed.id,
        label: bed.label,
        price: Math.round(bed.price_piastres / 100),
        status: bed.status,
      })),
  }));

  return {
    ...unit,
    rooms: unitRooms,
    photoUrls: await loadPhotos(supabase, id),
  };
}

function fromSample(id: string): UnitView | null {
  const unit = getSampleUnit(id);
  return unit ? { ...unit, rooms: [], photoUrls: [], isLive: true } : null;
}
