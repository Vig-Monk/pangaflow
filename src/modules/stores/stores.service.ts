// =============================================================================
// src/modules/stores/stores.service.ts
// Storefront Settings, Channel Configuration & Hero Notes Management
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

/**
 * Defensive server-side HTML sanitizer.
 * Strips script tags, javascript: URIs, onerror/onload attributes while
 * preserving formatting, hyperlinks, images, and safe video embed iframes.
 */
function sanitizeRichTextHtml(input: string): string {
    if (!input || typeof input !== "string") return "";

    let sanitized = input
        // Remove script tags and their inner content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        // Strip inline javascript: protocol
        .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"')
        .replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""')
        // Strip all event handlers (onclick, onload, onerror, etc.)
        .replace(/\s+on[a-z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, "")
        // Strip data: URIs in tags other than images
        .replace(/<iframe\b[^>]*src\s*=\s*["']?data:[^"'>]*[^>]*>/gi, "");

    // Verify iframe embed sources (only permit YouTube, Vimeo, and soundcloud)
    sanitized = sanitized.replace(/<iframe\b([^>]*)src=["']([^"']*)["']([^>]*)>/gi, (match, before, src, after) => {
        const isAllowedSrc =
            /^https:\/\/(www\.)?(youtube\.com\/embed\/|player\.vimeo\.com\/video\/|w\.soundcloud\.com\/player\/)/i.test(src);
        if (!isAllowedSrc) {
            return `<!-- Blocked unauthorized iframe src: ${src} -->`;
        }
        return `<iframe ${before}src="${src}"${after} loading="lazy" frameborder="0" allowfullscreen>`;
    });

    return sanitized.trim();
}

export const HeroNotesSchema = z.object({
    is_active: z.boolean().default(false),
    title: z.string().min(1, "Title is required").max(100, "Title cannot exceed 100 characters").default("Reader Announcements"),
    content_html: z.string().max(30000, "Content exceeds maximum length").transform(sanitizeRichTextHtml),
    bg_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color code").optional().default("#FAF7F0"),
    text_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color code").optional().default("#141E1A"),
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

export async function fetchHeroNotes(orgId: string): Promise<storesQueries.StoreHeroNotes> {
    return storesQueries.getHeroNotes(orgId);
}

export async function saveHeroNotes(orgId: string, rawBody: unknown): Promise<storesQueries.StoreHeroNotes> {
    const parsed = HeroNotesSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid hero notes configuration",
            400
        );
    }
    return storesQueries.updateHeroNotes(orgId, parsed.data);
}