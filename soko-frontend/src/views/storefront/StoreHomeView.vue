<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/StoreHomeView.vue
// Polished customer-facing product grid: 4 columns desktop, 3 tablet, 2 mobile.
// Clear category navigation in both Light and Dark themes, clean 4:5 image cards.
// =============================================================================

import { onMounted, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { apiGet } from '@/services/apiClient';
import StoreHero from '@/components/storefront/StoreHero.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { ShoppingBag, Plus } from 'lucide-vue-next';

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock?: number;
  images: string[];
  category: { name: string };
  availability: 'in_stock' | 'out_of_stock';
}

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();
const cartStore = useCartStore();
const { push: pushToast } = useToast();

const products = ref<PublicProduct[]>([]);
const selectedCategory = ref('All');

const loadingStore = ref(true);
const loadingProducts = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

const categories = computed(() => {
  const list = products.value.map((p) => p.category?.name).filter(Boolean);
  return ['All', ...Array.from(new Set(list))];
});

const filteredProducts = computed(() => {
  if (!selectedCategory.value || selectedCategory.value === 'All') {
    return products.value;
  }
  return products.value.filter((p) => p.category?.name === selectedCategory.value);
});

async function loadCatalog(): Promise<void> {
  if (!storeSlug.value) return;

  loadError.value = false;
  loadingStore.value = true;
  loadingProducts.value = true;

  try {
    const settings = await apiGet<any>(`/public/stores/${storeSlug.value}`);
    storeSettingsStore.settings = settings;
    loadingStore.value = false;

    products.value = await apiGet<PublicProduct[]>(`/public/stores/${storeSlug.value}/products`);
    loadingProducts.value = false;
  } catch {
    loadError.value = true;
    loadingStore.value = false;
    loadingProducts.value = false;
  }
}

onMounted(() => {
  cartStore.initForStore(storeSlug.value);
  loadCatalog();
});

watch(
  () => route.params.storeSlug,
  (newSlug) => {
    if (newSlug) {
      cartStore.initForStore(String(newSlug).toLowerCase().trim());
      loadCatalog();
    }
  }
);

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleQuickAddToCart(prod: PublicProduct, event: Event): void {
  event.preventDefault();
  event.stopPropagation();

  if (prod.availability === 'out_of_stock') return;

  const firstImage = prod.images && prod.images.length > 0 ? prod.images[0] : null;

  cartStore.addItem(
    storeSlug.value,
    prod.id,
    prod.name,
    firstImage,
    prod.price,
    1,
    prod.stock
  );

  pushToast({ message: `Added ${prod.name} to cart`, variant: 'success' });
}
</script>

<template>
  <div class="storefront-home-page">
    <!-- Error State -->
    <div v-if="loadError" class="store-state-container">
      <EmptyState
        title="Store offline"
        description="This store address does not exist or has been placed in draft mode by the merchant."
        action-label="Try again"
        :on-action="loadCatalog"
      />
    </div>

    <template v-else>
      <!-- Store Introduction Hero -->
      <section v-if="!loadingStore" class="hero-wrapper">
        <StoreHero :settings="storeSettingsStore.settings" />
      </section>

      <!-- Category Navigation (Desktop Bar + Mobile Swipe) -->
      <nav v-if="!loadingProducts && categories.length > 1" class="category-nav-bar">
        <div class="category-nav-inner">
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="category-tab"
            :class="{ active: selectedCategory === cat }"
            @click="selectedCategory = cat"
          >
            {{ cat }}
          </button>
        </div>
      </nav>

      <!-- Main Product Grid Section -->
      <div class="catalog-content-container">
        <!-- Skeleton Loading Grid -->
        <div v-if="loadingProducts" class="products-grid">
          <div v-for="n in 8" :key="n" class="skeleton-product-card">
            <div class="skeleton-image-box"></div>
            <div class="skeleton-line-title"></div>
            <div class="skeleton-line-price"></div>
          </div>
        </div>

        <!-- Empty Products State -->
        <div v-else-if="filteredProducts.length === 0" class="store-state-container">
          <EmptyState
            title="No products found"
            description="No items match your selected category. Try selecting another category."
            action-label="View all products"
            :on-action="() => (selectedCategory = 'All')"
          />
        </div>

        <!-- Products Grid -->
        <div v-else class="products-grid">
          <RouterLink
            v-for="prod in filteredProducts"
            :key="prod.id"
            :to="{
              name: 'storefront-product-detail',
              params: { storeSlug, productSlug: prod.slug },
            }"
            class="product-card"
          >
            <!-- 4:5 Aspect Ratio Image Frame -->
            <div class="product-card__media">
              <img
                v-if="prod.images && prod.images.length > 0"
                :src="prod.images[0]"
                :alt="prod.name"
                class="product-card__img"
                loading="lazy"
              />
              <div v-else class="product-card__placeholder">
                <ShoppingBag :size="32" />
              </div>

              <!-- Out of Stock Tag -->
              <span v-if="prod.availability === 'out_of_stock'" class="out-of-stock-pill">
                Out of stock
              </span>

              <!-- Quick Add Action Button -->
              <button
                v-if="prod.availability === 'in_stock'"
                type="button"
                class="quick-add-btn"
                aria-label="Add to cart"
                @click="(e) => handleQuickAddToCart(prod, e)"
              >
                <Plus :size="16" />
              </button>
            </div>

            <!-- Product Details -->
            <div class="product-card__body">
              <h3 class="product-card__name">{{ prod.name }}</h3>
              <p class="product-card__price font-mono">{{ formatCurrency(prod.price) }}</p>
            </div>
          </RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.storefront-home-page {
  min-height: 70vh;
}

.store-state-container {
  max-width: 600px;
  margin: 80px auto;
  padding: 0 24px;
}

/* Category Navigation */
.category-nav-bar {
  border-bottom: 1px solid var(--store-border);
  background-color: var(--store-surface);
  position: sticky;
  top: 67px;
  z-index: 80;
  transition: background-color 200ms ease, border-color 200ms ease;
}

.category-nav-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 32px;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE */
}

.category-nav-inner::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.category-tab {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--store-text-secondary);
  padding: 14px 0;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: color 150ms ease;
}

.category-tab:hover {
  color: var(--store-text);
}

.category-tab.active {
  color: var(--store-text);
  font-weight: 600;
}

.category-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--store-accent);
}

/* Main Content & Product Grid */
.catalog-content-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

@media (max-width: 640px) {
  .catalog-content-container { padding: 28px 16px 60px; }
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 36px 24px;
}

@media (max-width: 1024px) {
  .products-grid { grid-template-columns: repeat(3, 1fr); gap: 28px 18px; }
}

@media (max-width: 640px) {
  .products-grid { grid-template-columns: repeat(2, 1fr); gap: 20px 12px; }
}

/* Product Card */
.product-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-decoration: none;
  color: var(--store-text);
}

.product-card__media {
  position: relative;
  aspect-ratio: 4 / 5;
  background-color: var(--store-soft);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1);
}

.product-card:hover .product-card__img {
  transform: scale(1.02);
}

.product-card__placeholder {
  color: var(--store-text-muted);
}

.out-of-stock-pill {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.75);
  color: #FFFFFF;
  padding: 2px 8px;
  border-radius: 4px;
}

.quick-add-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--store-surface);
  border: 1px solid var(--store-border);
  color: var(--store-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 150ms ease, color 150ms ease, transform 150ms ease;
}

.quick-add-btn:hover {
  background: var(--store-accent);
  color: #FFFFFF;
  border-color: var(--store-accent);
  transform: scale(1.06);
}

@media (min-width: 1025px) {
  .quick-add-btn {
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 200ms ease, transform 200ms ease;
  }
  .product-card:hover .quick-add-btn {
    opacity: 1;
    transform: translateY(0);
  }
}

.product-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-card__name {
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--store-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-card__price {
  font-size: 14px;
  font-weight: 600;
  color: var(--store-text);
}

/* Skeleton Loading Cards */
.skeleton-product-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-image-box {
  aspect-ratio: 4 / 5;
  background-color: var(--store-skeleton);
  border-radius: 10px;
  animation: shimmer 1.5s infinite ease-in-out;
}

.skeleton-line-title {
  height: 14px;
  width: 75%;
  background-color: var(--store-skeleton);
  border-radius: 4px;
}

.skeleton-line-price {
  height: 14px;
  width: 40%;
  background-color: var(--store-skeleton);
  border-radius: 4px;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>