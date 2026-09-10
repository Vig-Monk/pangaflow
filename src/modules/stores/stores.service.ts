// =============================================================================
// src/modules/stores/stores.service.ts
// =============================================================================

import { z } from "zod";
import { AppError } from "../../utils/error";
import * as storesQueries from "./stores.queries";

const RESERVED_SLUGS = [
    "admin",
    "api",
    "dashboard",
    "login",
    "register",
    "orders",
    "products",
    "inventory",
    "expenses",
    "customers",
    "settings",
    "store",
    "public",
    "health",
    "auth",
    "logout",
    "cart",
    "checkout",
    "help",
    "support"
];

export const PromoTickerItemSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(3, "Message must be at least 3 characters").max(200, "Message cannot exceed 200 characters"),
    link: z.string().max(300).nullable().optional(),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().default(0)
});

export const SavePromoTickerSchema = z.object({
    items: z.array(PromoTickerItemSchema).max(10, "Maximum of 10 promotional ticker messages allowed")
});

export const SaveStoreSchema = z.object({
    name: z.string().min(1, "Store name is required").max(200),
    slug: z
        .string()
        .min(1, "Store address url is required")
        .max(100)
        .transform(s =>
            s
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
        )
        .refine(slug => slug.length > 0, {
            message: "Store address url is required"
        })
        .refine(slug => !RESERVED_SLUGS.includes(slug), {
            message:
                "This store address URL is a reserved system name. Please choose another."
        }),
    description: z
        .string()
        .max(1000)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    logo_url: z
        .string()
        .url("Logo link must be a valid URL")
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    cover_image_url: z
        .string()
        .url("Cover link must be a valid URL")
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    contact_phone: z
        .string()
        .max(20)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    contact_email: z
        .string()
        .email("Contact email must be valid")
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    location: z
        .string()
        .max(300)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    delivery_info: z
        .string()
        .max(1000)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    status: z.enum(["draft", "published", "suspended"]).default("draft"),
    hero_layout: z
        .enum(["editorial", "split", "minimal", "promotional"])
        .default("editorial"),
    hero_headline: z
        .string()
        .max(300)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    hero_subheadline: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    hero_cta_label: z
        .string()
        .max(50)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v))
});

export const SaveMerchantLocationSchema = z.object({
    name: z
        .string()
        .min(1, "Location hub name is required")
        .max(200)
        .default("Main Store / Hub"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address_text: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    max_delivery_radius_km: z.number().positive().max(100).default(15),
    base_delivery_fee: z.number().nonnegative().default(100),
    fee_per_km: z.number().nonnegative().default(25)
});

export async function fetchStoreSettings(orgId: string) {
    return storesQueries.getStoreByOrgId(orgId);
}

export async function saveStoreSettings(orgId: string, rawBody: unknown) {
    const parsed = SaveStoreSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400
        );
    }

    const conflict = await storesQueries.checkSlugConflict(
        orgId,
        parsed.data.slug
    );
    if (conflict) {
        throw new AppError(
            "This store address URL is already taken by another merchant.",
            409
        );
    }

    return storesQueries.upsertStore(orgId, parsed.data);
}

export async function fetchMerchantLocation(orgId: string) {
    return storesQueries.getMerchantLocation(orgId);
}

export async function saveMerchantLocation(orgId: string, rawBody: unknown) {
    const parsed = SaveMerchantLocationSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid location configuration",
            400
        );
    }

    return storesQueries.upsertMerchantLocation(orgId, parsed.data);
}

export async function fetchPromoTicker(orgId: string) {
    return storesQueries.getPromoTicker(orgId);
}

export async function savePromoTicker(orgId: string, rawBody: unknown) {
    const body = Array.isArray(rawBody) ? { items: rawBody } : rawBody;
    const parsed = SavePromoTickerSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid promotional ticker data",
            400
        );
    }
    return storesQueries.updatePromoTicker(orgId, parsed.data.items);
}