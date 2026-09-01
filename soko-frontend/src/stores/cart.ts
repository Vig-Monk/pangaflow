// =============================================================================
// soko-frontend/src/stores/cart.ts
// Compound-keyed Cart Store supporting distinct product variant lines & persistence.
// =============================================================================

import { defineStore } from 'pinia';

export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  variant_title?: string | null;
  name: string;
  image_url: string | null;
  price: number;
  quantity: number;
  stock?: number;
}

export interface CheckoutDraftState {
  deliveryType: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryLocation: string;
  customerLat: number | null;
  customerLng: number | null;
  locationSource: 'gps' | 'local_list' | 'nominatim' | 'manual_text';
  locationAccuracyM: number | null;
  estate: string;
  landmark: string;
  houseNumber: string;
  notes: string;
  paymentMethod: string;
}

const CART_PREFIX = 'soko_cart_';
const CHECKOUT_PREFIX = 'soko_checkout_state_';

function getCartStorageKey(slug: string): string {
  return `${CART_PREFIX}${slug.toLowerCase().trim()}`;
}

function getCheckoutStorageKey(slug: string): string {
  return `${CHECKOUT_PREFIX}${slug.toLowerCase().trim()}`;
}

function matchesItem(item: CartItem, productId: string, variantId?: string | null): boolean {
  const itemVariant = item.variant_id || null;
  const targetVariant = variantId || null;
  return item.product_id === productId && itemVariant === targetVariant;
}

function loadCartForStore(slug: string): CartItem[] {
  if (typeof window === 'undefined' || !slug) return [];
  const stored = localStorage.getItem(getCartStorageKey(slug));
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveCartForStore(slug: string, items: CartItem[]): void {
  if (typeof window === 'undefined' || !slug) return;
  if (items.length === 0) {
    localStorage.removeItem(getCartStorageKey(slug));
  } else {
    localStorage.setItem(getCartStorageKey(slug), JSON.stringify(items));
  }
}

function loadCheckoutDraft(slug: string): Partial<CheckoutDraftState> {
  if (typeof window === 'undefined' || !slug) return {};
  const stored = localStorage.getItem(getCheckoutStorageKey(slug));
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function saveCheckoutDraft(slug: string, draft: Partial<CheckoutDraftState>): void {
  if (typeof window === 'undefined' || !slug) return;
  localStorage.setItem(getCheckoutStorageKey(slug), JSON.stringify(draft));
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    storeSlug: '' as string,
    items: [] as CartItem[],
    checkoutDraft: {
      deliveryType: 'delivery',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deliveryLocation: '',
      customerLat: null,
      customerLng: null,
      locationSource: 'manual_text',
      locationAccuracyM: null,
      estate: '',
      landmark: '',
      houseNumber: '',
      notes: '',
      paymentMethod: 'mpesa_cash',
    } as CheckoutDraftState,
  }),

  getters: {
    isEmpty: (state): boolean => state.items.length === 0,

    totalItems: (state): number => {
      return state.items.reduce((total, item) => total + item.quantity, 0);
    },

    subtotal: (state): number => {
      const sum = state.items.reduce((total, item) => total + item.price * item.quantity, 0);
      return Math.round(sum * 100) / 100;
    },
  },

  actions: {
    initForStore(slug: string): void {
      const normalized = (slug || '').toLowerCase().trim();
      if (!normalized) return;
      if (this.storeSlug !== normalized) {
        this.storeSlug = normalized;
        this.items = loadCartForStore(normalized);
        const savedDraft = loadCheckoutDraft(normalized);
        this.checkoutDraft = { ...this.checkoutDraft, ...savedDraft };
      }
    },

    setCheckoutDraft(draft: Partial<CheckoutDraftState>): void {
      this.checkoutDraft = { ...this.checkoutDraft, ...draft };
      if (this.storeSlug) {
        saveCheckoutDraft(this.storeSlug, this.checkoutDraft);
      }
    },

    addItem(
      storeSlug: string,
      productId: string,
      name: string,
      imageUrl: string | null,
      price: number,
      quantity: number,
      maxStock?: number,
      variantId?: string | null,
      variantTitle?: string | null
    ): void {
      this.initForStore(storeSlug);

      const limit = maxStock !== undefined ? Math.min(10, Math.max(1, maxStock)) : 10;
      const existing = this.items.find((item) => matchesItem(item, productId, variantId));

      if (existing) {
        existing.quantity = Math.min(limit, existing.quantity + quantity);
      } else {
        this.items.push({
          product_id: productId,
          variant_id: variantId || null,
          variant_title: variantTitle || null,
          name,
          image_url: imageUrl,
          price,
          quantity: Math.min(limit, quantity),
          stock: maxStock,
        });
      }
      saveCartForStore(this.storeSlug, this.items);
    },

    updateQuantity(
      productId: string,
      quantity: number,
      maxStock?: number,
      variantId?: string | null
    ): void {
      const item = this.items.find((item) => matchesItem(item, productId, variantId));
      if (item) {
        const boundStock = maxStock !== undefined ? maxStock : item.stock;
        const limit = boundStock !== undefined ? Math.min(10, Math.max(1, boundStock)) : 10;
        item.quantity = Math.max(1, Math.min(limit, quantity));
        saveCartForStore(this.storeSlug, this.items);
      }
    },

    removeItem(productId: string, variantId?: string | null): void {
      this.items = this.items.filter((item) => !matchesItem(item, productId, variantId));
      saveCartForStore(this.storeSlug, this.items);
    },

    clearCart(): void {
      this.items = [];
      if (this.storeSlug) {
        saveCartForStore(this.storeSlug, []);
        localStorage.removeItem(getCheckoutStorageKey(this.storeSlug));
      }
    },
  },
});