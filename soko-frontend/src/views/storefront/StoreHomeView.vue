<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/StoreHomeView.vue
// =============================================================================

import { onMounted, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { apiGet } from '@/services/apiClient';
import StoreHero from '@/components/storefront/StoreHero.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { ShoppingBag, Plus, Tag, ArrowUpDown, CheckSquare, Square } from 'lucide-vue-next';

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
const selectedCategory = ref('');
const inStockOnly = ref(false);
const priceSort = ref<'default' | 'asc' | 'desc'>('default');

const loadingStore = ref(true);
const loadingProducts = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

const categories = computed(() => {
  const list = products.value.map(p => p.category?.name).filter(Boolean);
  return ['All', ...Array.from(new Set(list))];
});

const productsByCategory = computed(() => {
  let result = [...products.value];

  if (selectedCategory.value && selectedCategory.value !== 'All') {
    result = result.filter(p => p.category?.name === selectedCategory.value);
  }

  if (inStockOnly.value) {
    result = result.filter(p => p.availability === 'in_stock');
  }

  if (priceSort.value === 'asc') {
    result.sort((a, b) => a.price - b.price);
  } else if (priceSort.value === 'desc') {
    result.sort((a, b) => b.price - a.price);
  }

  const map: Record<string, PublicProduct[]> = {};
  for (const prod of result) {
    const catName = prod.category?.name || 'General';
    if (!map[catName]) {
      map[catName] = [];
    }
    map[catName].push(prod);
  }
  return map;
});

async function loadStoreData(): Promise<void> {
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
  } catch (err) {
    loadError.value = true;
    loadingStore.value = false;
    loadingProducts.value = false;
  }
}

onMounted(() => {
  cartStore.initForStore(storeSlug.value);
  loadStoreData();
});

watch(() => route.params.storeSlug, (newSlug) => {
  if (newSlug) {
    cartStore.initForStore(String(newSlug).toLowerCase().trim());
    loadStoreData();
  }
});

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
  <div class="store-homepage">
    <div v-if="loadError" class="error-container card">
      <EmptyState
        title="Storefront Offline"
        description="This store address does not exist or has been set to draft mode by the merchant."
        action-label="Try Again"
        :on-action="loadStoreData"
      />
    </div>

    <template v-else>
      <section class="store-hero-section">
        <div v-if="loadingStore" class="hero-skeleton">
          <Skeleton height="320px" radius="0" />
        </div>
        <StoreHero v-else :settings="storeSettingsStore.settings" />
      </section>

      <div class="promoted-categories-bar" v-if="!loadingProducts && products.length > 0">
        <div class="categories-bar-inner">
          <div class="categories-label">
            <Tag :size="16" /> Categories:
          </div>
          <div class="filter-wrap">
            <button
              v-for="cat in categories"
              :key="cat"
              class="filter-tab"
              :class="{ 'filter-tab--active': (cat === 'All' && !selectedCategory) || selectedCategory === cat }"
              @click="selectedCategory = cat === 'All' ? '' : cat"
            >
              {{ cat }}
            </button>
          </div>

          <div class="catalog-controls-toolbar">
            <button 
              class="control-toggle-btn"
              :class="{ active: inStockOnly }"
              type="button"
              @click="inStockOnly = !inStockOnly"
              title="Filter items currently in stock"
            >
              <component :is="inStockOnly ? CheckSquare : Square" :size="16" />
              <span>In Stock Only</span>
            </button>

            <div class="sort-select-wrapper">
              <ArrowUpDown :size="14" class="sort-icon" />
              <select v-model="priceSort" class="sort-select">
                <option value="default">Sort by: Featured</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="catalog-container">
        <div v-if="loadingProducts" class="products-grid-skeleton">
          <div v-for="n in 4" :key="n" class="skeleton-card">
            <Skeleton height="220px" />
            <Skeleton height="24px" width="70%" />
            <Skeleton height="20px" width="40%" />
          </div>
        </div>

        <template v-else>
          <div v-if="products.length === 0" class="empty-catalog card">
            <EmptyState
              title="Welcome to our new store"
              description="Check back soon! Products are currently being prepared for catalog publication."
            />
          </div>

          <div v-else-if="Object.keys(productsByCategory).length === 0" class="empty-catalog card">
            <EmptyState
              title="No products match your filters"
              description="Try adjusting your category selection or stock filters to view available inventory."
              action-label="Reset Filters"
              :on-action="() => { selectedCategory = ''; inStockOnly = false; priceSort = 'default'; }"
            />
          </div>

          <div v-else class="catalog-sections-stack">
            <div v-for="(catProducts, categoryName) in productsByCategory" :key="categoryName" class="category-section-group">
              <div class="category-section-header">
                <h2 class="category-section-title font-display">{{ categoryName }}</h2>
                <span class="category-count tabular-figure">{{ catProducts.length }} items</span>
              </div>

              <div class="products-grid">
                <router-link
                  v-for="prod in catProducts"
                  :key="prod.id"
                  :to="{ name: 'storefront-product-detail', params: { storeSlug, productSlug: prod.slug } }"
                  class="product-card"
                >
                  <div class="product-card__media">
                    <img v-if="prod.images && prod.images.length > 0" :src="prod.images[0]" :alt="prod.name" class="product-card__img" />
                    <div v-else class="product-card__img-placeholder">
                      <ShoppingBag :size="32" />
                    </div>
                    
                    <span v-if="prod.availability === 'out_of_stock'" class="out-of-stock-badge">
                      Out of Stock
                    </span>

                    <button
                      v-if="prod.availability === 'in_stock'"
                      class="quick-add-btn"
                      type="button"
                      title="Quick add to cart"
                      @click="(e) => handleQuickAddToCart(prod, e)"
                    >
                      <Plus :size="18" />
                    </button>
                  </div>

                  <div class="product-card__info">
                    <p class="product-category">{{ prod.category?.name || 'General' }}</p>
                    <h3 class="product-name">{{ prod.name }}</h3>
                    <p class="product-price tabular-figure">{{ formatCurrency(prod.price) }}</p>
                  </div>
                </router-link>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.store-homepage {
  min-height: 80vh;
}

.error-container {
  max-width: 600px;
  margin: var(--space-16) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.promoted-categories-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 73px;
  z-index: 90;
  box-shadow: var(--shadow-sm);
}

.categories-bar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.categories-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  display: none;
}

@media (min-width: 768px) {
  .categories-label { display: flex; }
}

.filter-wrap {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  flex: 1;
  padding-bottom: 2px;
}

.filter-tab {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard);
}

.filter-tab:hover {
  border-color: var(--color-ink);
}

.filter-tab--active {
  background: var(--color-ink);
  color: var(--color-text-inverse);
  border-color: var(--color-ink);
}

.catalog-controls-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-left: auto;
}

.control-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.control-toggle-btn.active {
  background: color-mix(in srgb, var(--color-ink) 10%, transparent);
  color: var(--color-ink);
  border-color: var(--color-ink);
}

.sort-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0 var(--space-4);
  min-height: 36px;
}

.sort-icon {
  color: var(--color-text-muted);
  margin-right: var(--space-2);
}

.sort-select {
  background: transparent;
  border: none;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
  outline: none;
  cursor: pointer;
}

.catalog-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.catalog-sections-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.category-section-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.category-section-title {
  font-size: var(--text-2xl);
  color: var(--color-text);
}

.category-count {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.products-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-6);
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-catalog {
  max-width: 600px;
  margin: var(--space-12) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-6);
}

.product-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: var(--color-text);
  transition: transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-fast) var(--ease-standard);
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.product-card__media {
  height: 220px;
  background: var(--color-bg);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card__img-placeholder {
  color: var(--color-text-muted);
}

.out-of-stock-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: var(--color-market-clay);
  color: var(--color-text-inverse);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
}

.quick-add-btn {
  position: absolute;
  bottom: var(--space-3);
  right: var(--space-3);
  width: 36px;
  height: 36px;
  background: var(--color-ink);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard),
              background var(--duration-fast) var(--ease-standard);
}

.product-card:hover .quick-add-btn {
  opacity: 1;
  transform: translateY(0);
}

.quick-add-btn:hover {
  background: var(--color-gold);
  color: var(--color-text);
}

@media (max-width: 768px) {
  .quick-add-btn {
    opacity: 1;
    transform: translateY(0);
  }
}

.product-card__info {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-category {
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.product-name {
  font-size: var(--text-base);
  font-weight: 600;
}

.product-price {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-ink);
  margin-top: var(--space-1);
}
</style>