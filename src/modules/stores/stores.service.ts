// =============================================================================
// src/modules/stores/stores.service.ts
// =============================================================================

import { z } from "zod";
import { AppError } from "../../utils/error";
import * as storesQueries from "./stores.queries";
import { getCredentialsRowByOrgId } from "../mpesa-credentials/mpesa-credentials.queries";

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

export const SaveStoreSchema = z.object({
    name: z.string().min(1, "Store name is required").max(200),
    slug: z
        .string()
        .min(1, "Store address url is required")
        .max(100)
        .regex(
            /^[a-z0-9-]+$/,
            "Slug must only contain lowercase alphanumeric characters and hyphens"
        )
        .refine(slug => !RESERVED_SLUGS.includes(slug.toLowerCase().trim()), {
            message:
                "This store address URL is a reserved system name. Please choose another."
        }),
    description: z.string().max(1000).nullable().optional(),
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
    contact_phone: z.string().max(20).nullable().optional(),
    contact_email: z
        .string()
        .email("Contact email must be valid")
        .nullable()
        .optional()
        .or(z.literal(""))
        .transform(v => (v === "" ? null : v)),
    location: z.string().max(300).nullable().optional(),
    delivery_info: z.string().max(1000).nullable().optional(),
    status: z.enum(["draft", "published", "suspended"]).default("draft"),
    hero_layout: z
        .enum(["editorial", "split", "minimal", "promotional"])
        .default("editorial"),
    hero_headline: z.string().max(300).nullable().optional(),
    hero_subheadline: z.string().max(500).nullable().optional(),
    hero_cta_label: z.string().max(50).nullable().optional()
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

    // STEP 7 GUARD:
    // Block publishing if merchant M-Pesa credentials are not verified
    if (parsed.data.status === "published") {
        const creds = await getCredentialsRowByOrgId(orgId);
        if (!creds || creds.status !== "verified") {
            throw new AppError(
                "Cannot publish store until M-Pesa credentials have been connected and verified. Please complete M-Pesa Setup in Settings.",
                400
            );
        }
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