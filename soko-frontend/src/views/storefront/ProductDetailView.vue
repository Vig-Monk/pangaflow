<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/ProductDetailView.vue
// Interactive product detail view with dynamic variant attribute pills & real-time pricing.
// =============================================================================

import { onMounted, ref, computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { useStoreSettingsStore } from '@/stores/store';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Truck,
  ShieldCheck,
} from 'lucide-vue-next';

interface PublicProductVariant {
  id: string;
  title: string;
  sku: string | null;
  options: Record<string, string>;
  price: number;
  cost_price: number;
  stock: number;
  low_stock_at: number;
  image_url: string | null;
  is_active: boolean;
}

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[];
  category: { name: string };
  availability: 'in_stock' | 'out_of_stock';
  variants?: PublicProductVariant[];
}

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();
const storeSettingsStore = useStoreSettingsStore();
const { push: pushToast } = useToast();

const product = ref<PublicProduct | null>(null);
const activeImage = ref('');
const quantitySelection = ref(1);

const loading = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());
const productSlug = computed(() => (route.params.productSlug as string || '').trim());

// Reactive selected attribute dimensions (e.g. { "Size": "42", "Color": "Black" })
const selectedOptions = reactive<Record<string, string>>({});

// Extract unique option dimensions e.g. { "Size": ["40", "41", "42"], "Color": ["White", "Black"] }
const optionDimensions = computed(() => {
  if (!product.value?.variants || product.value.variants.length === 0) return {};
  const dims: Record<string, string[]> = {};
  for (const v of product.value.variants) {
    if (v.options && typeof v.options === 'object') {
      for (const [key, val] of Object.entries(v.options)) {
        if (!dims[key]) dims[key] = [];
        if (!dims[key].includes(val)) {
          dims[key].push(val);
        }
      }
    }
  }
  return dims;
});

// Resolves the currently active variant matching all selected pills
const activeVariant = computed<PublicProductVariant | null>(() => {
  if (!product.value?.variants || product.value.variants.length === 0) return null;
  const keys = Object.keys(optionDimensions.value);
  if (keys.length === 0) return product.value.variants[0] || null;

  return (
    product.value.variants.find((v) => {
      return keys.every((k) => v.options?.[k] === selectedOptions[k]);
    }) || null
  );
});

const currentDisplayPrice = computed(() => {
  if (activeVariant.value) return activeVariant.value.price;
  return product.value?.price || 0;
});

const isCurrentlyInStock = computed(() => {
  if (activeVariant.value) return activeVariant.value.stock > 0;
  return product.value?.availability === 'in_stock';
});

const currentStockCount = computed(() => {
  if (activeVariant.value) return activeVariant.value.stock;
  return product.value?.stock || 0;
});

const availableStockLimit = computed(() => {
  return Math.min(10, Math.max(1, currentStockCount.value || 1));
});

function selectOption(key: string, value: string): void {
  selectedOptions[key] = value;
  quantitySelection.value = 1;

  // Auto-switch gallery photo if variant has a dedicated image
  if (activeVariant.value?.image_url) {
    activeImage.value = activeVariant.value.image_url;
  }
}

function initSelectedOptions(prod: PublicProduct): void {
  if (!prod.variants || prod.variants.length === 0) return;
  // Pick first in-stock variant by default, or first variant if all out
  const initial = prod.variants.find((v) => v.stock > 0) || prod.variants[0];
  if (initial && initial.options) {
    for (const [k, v] of Object.entries(initial.options)) {
      selectedOptions[k] = v;
    }
    if (initial.image_url) {
      activeImage.value = initial.image_url;
    }
  }
}

onMounted(async () => {
  cartStore.initForStore(storeSlug.value);
  try {
    if (!storeSettingsStore.settings) {
      const storeData = await apiGet<any>(`/public/stores/${storeSlug.value}`);
      storeSettingsStore.settings = storeData;
    }

    const data = await apiGet<PublicProduct>(`/public/stores/${storeSlug.value}/products/${productSlug.value}`);
    product.value = data;
    if (data.images && data.images.length > 0) {
      activeImage.value = data.images[0];
    }
    initSelectedOptions(data);
    loading.value = false;
  } catch {
    loadError.value = true;
    loading.value = false;
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function selectImage(url: string): void {
  activeImage.value = url;
}

function handleAddToCart(): void {
  if (!product.value || !isCurrentlyInStock.value) return;

  const imageToUse = activeImage.value || (product.value.images.length > 0 ? product.value.images[0] : null);
  const priceToUse = currentDisplayPrice.value;
  const variantId = activeVariant.value?.id || null;
  const variantTitle = activeVariant.value?.title || null;
  const stockToUse = currentStockCount.value;

  cartStore.addItem(
    storeSlug.value,
    product.value.id,
    product.value.name,
    imageToUse,
    priceToUse,
    quantitySelection.value,
    stockToUse,
    variantId,
    variantTitle
  );

  pushToast({
    message: `Added ${product.value.name}${variantTitle ? ` (${variantTitle})` : ''} to cart`,
    variant: 'success',
  });
}

function goBack(): void {
  router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
}
</script>

<template>
  <div class="product-detail-page">
    <div class="detail-container">
      <header class="detail-header">
        <Button variant="ghost" @click="goBack"><ArrowLeft :size="16" /> Back to Catalog</Button>
      </header>

      <div v-if="loadError" class="error-container">
        <div class="error-box card">
          <h2 class="error-title">Product Offline</h2>
          <p class="error-desc">This product could not be found, or has been set to draft mode by the merchant.</p>
        </div>
      </div>

      <template v-else>
        <div v-if="loading" class="detail-grid-skeleton">
          <div class="skeleton-gallery-wrap">
            <Skeleton height="360px" />
            <div class="skeleton-thumbnails">
              <Skeleton v-for="n in 3" :key="n" height="60px" width="60px" />
            </div>
          </div>
          <div class="skeleton-info-wrap">
            <Skeleton height="18px" width="30%" />
            <Skeleton height="32px" width="80%" />
            <Skeleton height="24px" width="40%" />
            <Skeleton height="90px" />
            <Skeleton height="44px" width="100%" />
          </div>
        </div>

        <div v-else-if="product" class="detail-layout">
          <!-- Gallery Column -->
          <div class="gallery-column">
            <div class="main-display card">
              <img v-if="activeImage" :src="activeImage" :alt="product.name" class="main-img" />
              <div v-else class="img-placeholder">
                <ShoppingBag :size="48" class="text-muted" />
              </div>
            </div>

            <div class="thumbnail-strip" v-if="product.images.length > 1">
              <button
                v-for="(img, idx) in product.images"
                :key="idx"
                class="thumb-btn"
                :class="{ 'thumb-btn--active': activeImage === img }"
                type="button"
                @click="selectImage(img)"
              >
                <img :src="img" alt="Gallery thumbnail" class="thumb-img" />
              </button>
            </div>
          </div>

          <!-- Buying Column -->
          <div class="info-column">
            <div class="info-header card">
              <span class="product-category">{{ product.category?.name || 'General' }}</span>
              <h1 class="product-name font-display">{{ product.name }}</h1>
              <p class="product-price tabular-figure">{{ formatCurrency(currentDisplayPrice) }}</p>

              <!-- Dynamic Stock Indicator -->
              <div class="product-status-alert">
                <span v-if="isCurrentlyInStock" class="status-indicator status-indicator--in">
                  <CheckCircle2 :size="15" /> In Stock ({{ currentStockCount }} available)
                </span>
                <span v-else class="status-indicator status-indicator--out">
                  <XCircle :size="15" /> Out of Stock
                </span>
              </div>

              <!-- DYNAMIC VARIANT OPTION PILLS -->
              <div v-if="Object.keys(optionDimensions).length > 0" class="variant-selectors-stack">
                <div
                  v-for="(values, dimensionKey) in optionDimensions"
                  :key="dimensionKey"
                  class="option-group"
                >
                  <label class="option-label">{{ dimensionKey }}: <strong>{{ selectedOptions[dimensionKey] }}</strong></label>
                  <div class="option-pills-row">
                    <button
                      v-for="val in values"
                      :key="val"
                      type="button"
                      class="option-pill"
                      :class="{ 'option-pill--active': selectedOptions[dimensionKey] === val }"
                      @click="selectOption(String(dimensionKey), val)"
                    >
                      {{ val }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Add to Cart Widget -->
              <div class="add-to-cart-widget" v-if="isCurrentlyInStock">
                <div class="quantity-picker-wrap">
                  <label class="form-label">Quantity</label>
                  <QuantityStepper
                    v-model="quantitySelection"
                    :max="availableStockLimit"
                    size="md"
                  />
                </div>

                <Button variant="primary" size="lg" style="width: 100%;" @click="handleAddToCart">
                  <ShoppingBag :size="18" /> Add to Cart • {{ formatCurrency(currentDisplayPrice * quantitySelection) }}
                </Button>
              </div>

              <div v-else class="out-of-stock-action-panel">
                <Button variant="secondary" size="lg" style="width: 100%;" disabled>
                  Selected Option Out of Stock
                </Button>
              </div>
            </div>

            <!-- Policy details -->
            <div class="secondary-details-card card">
              <div v-if="product.description" class="desc-block">
                <h3>Product Details</h3>
                <p class="product-desc">{{ product.description }}</p>
              </div>

              <div class="policy-block">
                <div class="policy-item">
                  <Truck :size="18" class="text-ink" />
                  <div>
                    <span class="policy-title">Delivery &amp; Fulfillment</span>
                    <span class="policy-desc">{{ storeSettingsStore.settings?.delivery_info || 'Doorstep delivery and in-person pickup options calculated at checkout.' }}</span>
                  </div>
                </div>
                <div class="policy-item">
                  <ShieldCheck :size="18" class="text-teal" />
                  <div>
                    <span class="policy-title">Verified Merchant Catalog</span>
                    <span class="policy-desc">Direct communication and delivery verification code on arrival.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.product-detail-page {
  padding: var(--space-8) var(--space-4);
  min-height: 80vh;
}

.detail-container {
  max-width: 1050px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: var(--space-4);
}

.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
}

.error-box {
  text-align: center;
  max-width: 420px;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.error-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--color-text);
}

.error-desc {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: var(--leading-relaxed);
}

.detail-grid-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
@media (min-width: 768px) {
  .detail-grid-skeleton { flex-direction: row; }
}
.skeleton-gallery-wrap { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-thumbnails { display: flex; gap: var(--space-2); }
.skeleton-info-wrap { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }

.detail-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
@media (min-width: 768px) {
  .detail-layout { flex-direction: row; align-items: flex-start; }
}

.gallery-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.main-display {
  height: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

@media (min-width: 768px) {
  .main-display { height: 420px; }
}

.main-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-strip {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

.thumb-btn {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}

.thumb-btn--active {
  border-color: var(--brand-primary);
  border-width: 2px;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-column {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.info-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.product-category {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  font-weight: 700;
}

.product-name {
  font-size: var(--text-2xl);
  color: var(--color-text);
  line-height: var(--leading-tight);
}

.product-price {
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-ink);
}

.product-status-alert {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
}
.status-indicator--in { color: var(--color-ledger-green); }
.status-indicator--out { color: var(--color-market-clay); }

/* Dynamic Variant Option Pills */
.variant-selectors-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 600;
}
.option-label strong {
  color: var(--color-text);
}

.option-pills-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.option-pill {
  min-height: 36px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.option-pill:hover {
  border-color: var(--color-ink);
}

.option-pill--active {
  background: var(--brand-primary);
  color: #FFFFFF;
  border-color: var(--brand-primary);
}

.add-to-cart-widget {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.quantity-picker-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.secondary-details-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.desc-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.desc-block h3 {
  font-size: var(--text-sm);
  font-weight: 700;
}

.product-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
}

.policy-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.policy-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.policy-title {
  display: block;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.policy-desc {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 1px;
}

.text-ink { color: var(--color-ink); }
.text-teal { color: var(--color-ledger-green); }
</style>