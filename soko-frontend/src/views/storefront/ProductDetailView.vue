<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/ProductDetailView.vue
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { useStoreSettingsStore } from '@/stores/store';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import { ArrowLeft, CheckCircle2, XCircle, ShoppingBag, Truck, ShieldCheck } from 'lucide-vue-next';

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

const storeSlug = computed(() => route.params.storeSlug as string);
const productSlug = computed(() => route.params.productSlug as string);

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

function selectImage(url: string): void {
  activeImage.value = url;
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

  pushToast({ message: 'Added to your shopping cart', variant: 'success' });
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
          <span class="error-icon">🔍</span>
          <h2 class="error-title">Product Offline</h2>
          <p class="error-desc">This product could not be found, or has been set to draft mode by the merchant.</p>
        </div>
      </div>

      <template v-else>
        <div v-if="loading" class="detail-grid-skeleton">
          <div class="skeleton-gallery-wrap">
            <Skeleton height="400px" />
            <div class="skeleton-thumbnails">
              <Skeleton v-for="n in 3" :key="n" height="60px" width="60px" />
            </div>
          </div>
          <div class="skeleton-info-wrap">
            <Skeleton height="20px" width="30%" />
            <Skeleton height="36px" width="80%" />
            <Skeleton height="28px" width="40%" />
            <Skeleton height="100px" />
            <Skeleton height="48px" width="100%" />
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
              <span class="product-category">{{ product.category.name }}</span>
              <h1 class="product-name font-display">{{ product.name }}</h1>
              <p class="product-price tabular-figure">{{ formatCurrency(product.price) }}</p>

              <div class="product-status-alert">
                <span v-if="product.availability === 'in_stock'" class="status-indicator status-indicator--in">
                  <CheckCircle2 :size="16" /> Available In Stock ({{ product.stock }} units)
                </span>
                <span v-else class="status-indicator status-indicator--out">
                  <XCircle :size="16" /> Temporarily Out of Stock
                </span>
              </div>

              <!-- Add to Cart Widget -->
              <div class="add-to-cart-widget" v-if="product.availability === 'in_stock'">
                <div class="quantity-picker-wrap">
                  <label class="form-label">Quantity</label>
                  <select v-model.number="quantitySelection" class="form-select">
                    <option v-for="qty in availableStockLimit" :key="qty" :value="qty">{{ qty }}</option>
                  </select>
                </div>
                
                <Button variant="primary" size="lg" style="width: 100%;" @click="handleAddToCart">
                  <ShoppingBag :size="18" /> Add to Cart
                </Button>
              </div>
              
              <div v-else class="out-of-stock-action-panel">
                <Button variant="secondary" size="lg" style="width: 100%;" disabled>
                  Out of Stock
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
                  <Truck :size="20" class="text-ink" />
                  <div>
                    <span class="policy-title">Delivery &amp; Fulfillment</span>
                    <span class="policy-desc">{{ storeSettingsStore.settings?.delivery_info || 'Fast delivery options coordinated directly with merchant.' }}</span>
                  </div>
                </div>
                <div class="policy-item">
                  <ShieldCheck :size="20" class="text-teal" />
                  <div>
                    <span class="policy-title">Secure Merchant Transaction</span>
                    <span class="policy-desc">Verified store catalog with direct consumer-to-merchant coordination.</span>
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
  max-width: 1100px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: var(--space-6);
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
  gap: var(--space-3);
}

.error-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-text);
}

.error-desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.detail-grid-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
@media (min-width: 768px) {
  .detail-grid-skeleton { flex-direction: row; }
}
.skeleton-gallery-wrap { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-thumbnails { display: flex; gap: var(--space-2); }
.skeleton-info-wrap { flex: 1; display: flex; flex-direction: column; gap: var(--space-4); }

.detail-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
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
  height: 400px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

@media (min-width: 768px) {
  .main-display { height: 460px; }
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
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}

.thumb-btn--active {
  border-color: var(--color-ink);
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
  gap: var(--space-6);
}

.info-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.product-category {
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.product-name {
  font-size: var(--text-3xl);
  color: var(--color-text);
  line-height: var(--leading-tight);
}

.product-price {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-ink);
}

.product-status-alert {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.status-indicator--in { color: var(--color-ledger-green); }
.status-indicator--out { color: var(--color-market-clay); }

.add-to-cart-widget {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  margin-top: var(--space-2);
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

.form-select {
  min-height: 44px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}

.secondary-details-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.desc-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
}

.desc-block h3 {
  font-size: var(--text-base);
  font-weight: 600;
}

.product-desc {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
}

.policy-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.policy-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.policy-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.policy-desc {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.text-ink { color: var(--color-ink); }
.text-teal { color: var(--color-ledger-green); }
</style>