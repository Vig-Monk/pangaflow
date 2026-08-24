<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/ProductDetailView.vue
// Editorial ecommerce product detail view with large gallery, clean typography,
// quantity stepper, and zero nested card borders.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { useStoreSettingsStore } from '@/stores/store';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { ArrowLeft, ShoppingBag } from 'lucide-vue-next';

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

const availableStockLimit = computed(() => {
  if (!product.value) return 1;
  return Math.min(10, Math.max(1, product.value.stock || 1));
});

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
    loading.value = false;
  } catch {
    loadError.value = true;
    loading.value = false;
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleAddToCart(): void {
  if (!product.value || product.value.availability === 'out_of_stock') return;

  const firstImage = product.value.images.length > 0 ? product.value.images[0] : null;

  cartStore.addItem(
    storeSlug.value,
    product.value.id,
    product.value.name,
    firstImage,
    product.value.price,
    quantitySelection.value,
    product.value.stock
  );

  pushToast({ message: `Added ${product.value.name} to cart`, variant: 'success' });
}

function goBack(): void {
  router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
}
</script>

<template>
  <div class="product-detail-view">
    <div class="detail-container">
      <!-- Back Navigation Link -->
      <nav class="back-nav">
        <button type="button" class="back-link-btn" @click="goBack">
          <ArrowLeft :size="15" /> Back to store
        </button>
      </nav>

      <!-- Error State -->
      <div v-if="loadError" class="state-wrap">
        <EmptyState
          title="Product not available"
          description="This product could not be found or has been placed in draft mode."
          action-label="Return to catalog"
          :on-action="goBack"
        />
      </div>

      <!-- Detail Grid -->
      <template v-else-if="product">
        <div class="detail-editorial-layout">
          <!-- Left Column: Gallery -->
          <div class="gallery-column">
            <!-- Primary Image -->
            <div class="primary-image-frame">
              <img v-if="activeImage" :src="activeImage" :alt="product.name" class="primary-img" />
              <div v-else class="img-placeholder">
                <ShoppingBag :size="48" />
              </div>
            </div>

            <!-- Thumbnail Strip -->
            <div v-if="product.images.length > 1" class="thumbnail-row">
              <button
                v-for="(img, idx) in product.images"
                :key="idx"
                type="button"
                class="thumb-btn"
                :class="{ active: activeImage === img }"
                @click="activeImage = img"
              >
                <img :src="img" :alt="`${product.name} preview ${idx + 1}`" class="thumb-img" />
              </button>
            </div>
          </div>

          <!-- Right Column: Product Information & Purchase -->
          <div class="info-column">
            <span class="product-category-tag">{{ product.category?.name || 'General' }}</span>
            <h1 class="product-title">{{ product.name }}</h1>
            <p class="product-price font-mono">{{ formatCurrency(product.price) }}</p>

            <!-- Availability Status -->
            <div class="availability-status">
              <span v-if="product.availability === 'in_stock'" class="status-badge status-badge--in">
                In stock ({{ product.stock }} available)
              </span>
              <span v-else class="status-badge status-badge--out">
                Out of stock
              </span>
            </div>

            <!-- Description -->
            <div v-if="product.description" class="product-description-block">
              <p class="description-text">{{ product.description }}</p>
            </div>

            <!-- Purchasing Actions -->
            <div v-if="product.availability === 'in_stock'" class="purchase-actions-block">
              <div class="stepper-row">
                <span class="stepper-label">Quantity</span>
                <QuantityStepper
                  v-model="quantitySelection"
                  :max="availableStockLimit"
                  size="md"
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                class="add-to-cart-btn"
                @click="handleAddToCart"
              >
                Add to cart · {{ formatCurrency(product.price * quantitySelection) }}
              </Button>
            </div>

            <div v-else class="out-of-stock-notice">
              <Button variant="secondary" size="lg" disabled class="full-width">
                Out of stock
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.product-detail-view {
  min-height: 80vh;
  padding: 36px 24px 80px;
}

@media (max-width: 640px) {
  .product-detail-view { padding: 20px 16px 60px; }
}

.detail-container {
  max-width: 1140px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.back-nav {
  display: flex;
}

.back-link-btn {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--store-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 0;
  transition: color 150ms ease;
}

.back-link-btn:hover {
  color: var(--store-text);
}

.detail-editorial-layout {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 56px;
  align-items: start;
}

@media (max-width: 860px) {
  .detail-editorial-layout {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}

/* Gallery */
.gallery-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.primary-image-frame {
  aspect-ratio: 4 / 5;
  background-color: var(--store-soft);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-placeholder {
  color: var(--store-text-muted);
}

.thumbnail-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}

.thumb-btn {
  width: 68px;
  height: 68px;
  border-radius: 8px;
  background-color: var(--store-soft);
  border: 1px solid var(--store-border);
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 150ms ease;
}

.thumb-btn.active {
  border-color: var(--store-accent);
  border-width: 2px;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Information Column */
.info-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-category-tag {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--store-text-muted);
}

.product-title {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: clamp(28px, 3.5vw, 38px);
  font-weight: 600;
  line-height: 1.15;
  color: var(--store-text);
  letter-spacing: -0.02em;
}

.product-price {
  font-size: 24px;
  font-weight: 600;
  color: var(--store-text);
}

.availability-status {
  display: flex;
}

.status-badge {
  font-size: 12px;
  font-weight: 500;
}

.status-badge--in { color: var(--store-success); }
.status-badge--out { color: var(--store-text-muted); }

.product-description-block {
  border-top: 1px solid var(--store-border);
  padding-top: 20px;
  margin-top: 4px;
}

.description-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--store-text-secondary);
  white-space: pre-line;
}

.purchase-actions-block {
  border-top: 1px solid var(--store-border);
  padding-top: 24px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stepper-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stepper-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--store-text);
}

.add-to-cart-btn {
  width: 100%;
  background-color: var(--store-accent);
  color: #FFFFFF;
  border-radius: 10px;
}

.full-width { width: 100%; }
</style>