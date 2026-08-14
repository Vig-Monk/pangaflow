// =============================================================================
// soko-frontend/src/stores/cart.ts
// =============================================================================

import { defineStore } from "pinia";

export interface CartItem {
    product_id: string;
    name: string;
    image_url: string | null;
    price: number;
    quantity: number;
}

const CART_PREFIX = "soko_cart_";

function getStorageKey(slug: string): string {
    return `${CART_PREFIX}${slug.toLowerCase().trim()}`;
}

function loadCartForStore(slug: string): CartItem[] {
    if (typeof window === "undefined" || !slug) return [];
    const stored = localStorage.getItem(getStorageKey(slug));
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

function saveCartForStore(slug: string, items: CartItem[]): void {
    if (typeof window === "undefined" || !slug) return;
    if (items.length === 0) {
        localStorage.removeItem(getStorageKey(slug));
    } else {
        localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
    }
}

export const useCartStore = defineStore("cart", {
    state: () => ({
        storeSlug: "" as string,
        items: [] as CartItem[]
    }),

    getters: {
        isEmpty: (state): boolean => state.items.length === 0,

        totalItems: (state): number => {
            return state.items.reduce(
                (total, item) => total + item.quantity,
                0
            );
        },

        subtotal: (state): number => {
            const sum = state.items.reduce(
                (total, item) => total + item.price * item.quantity,
                0
            );
            return Math.round(sum * 100) / 100;
        }
    },

    actions: {
        initForStore(slug: string): void {
            const normalized = (slug || "").toLowerCase().trim();
            if (!normalized) return;
            if (this.storeSlug !== normalized) {
                this.storeSlug = normalized;
                this.items = loadCartForStore(normalized);
            }
        },

        addItem(
            storeSlug: string,
            productId: string,
            name: string,
            imageUrl: string | null,
            price: number,
            quantity: number,
            maxStock?: number
        ): void {
            this.initForStore(storeSlug);

            const limit = maxStock !== undefined ? Math.min(10, Math.max(1, maxStock)) : 10;
            const existing = this.items.find((item) => item.product_id === productId);

            if (existing) {
                existing.quantity = Math.min(limit, existing.quantity + quantity);
            } else {
                this.items.push({
                    product_id: productId,
                    name,
                    image_url: imageUrl,
                    price,
                    quantity: Math.min(limit, quantity)
                });
            }
            saveCartForStore(this.storeSlug, this.items);
        },

        updateQuantity(productId: string, quantity: number, maxStock?: number): void {
            const item = this.items.find((item) => item.product_id === productId);
            if (item) {
                const limit = maxStock !== undefined ? Math.min(10, Math.max(1, maxStock)) : 10;
                item.quantity = Math.max(1, Math.min(limit, quantity));
                saveCartForStore(this.storeSlug, this.items);
            }
        },

        removeItem(productId: string): void {
            this.items = this.items.filter((item) => item.product_id !== productId);
            saveCartForStore(this.storeSlug, this.items);
        },

        clearCart(): void {
            this.items = [];
            if (this.storeSlug) {
                saveCartForStore(this.storeSlug, []);
            }
        }
    }
});