<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductEditView.vue
// Product edit form with interactive Draft vs. Published status switcher.
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProductsStore } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPatch } from '@/services/apiClient';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const productId = route.params.id as string;

const name = ref('');
const price = ref(0);
const costPrice = ref(0);
const sku = ref('');
const description = ref('');
const categoryId = ref('');
const status = ref<'draft' | 'published'>('published');
const isSaving = ref(false);

onMounted(async () => {
  await productsStore.fetchCategories();
  try {
    const prod = await apiGet<any>(`/products/${productId}`);
    name.value = prod.name;
    price.value = parseFloat(prod.price);
    costPrice.value = parseFloat(prod.cost_price || '0');
    sku.value = prod.sku ?? '';
    description.value = prod.description ?? '';
    categoryId.value = prod.category_id;
    status.value = prod.status === 'draft' ? 'draft' : 'published';
  } catch {
    pushToast({ message: 'Failed to load product details', variant: 'error' });
    router.push({ name: 'products' });
  }
});

async function handleSave(): Promise<void> {
  if (!name.value.trim() || price.value < 0) return;

  isSaving.value = true;
  try {
    await apiPatch(`/products/${productId}`, {
      name: name.value.trim(),
      price: Number(price.value),
      cost_price: Number(costPrice.value) || null,
      sku: sku.value.trim() || null,
      description: description.value.trim() || null,
      category_id: categoryId.value || undefined,
      status: status.value,
    });

    pushToast({ message: `Product "${name.value.trim()}" updated successfully`, variant: 'success' });
    router.push({ name: 'products' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Update failed', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="edit-product-page">
    <header class="page-top-nav">
      <Button variant="ghost" @click="router.push({ name: 'products' })">
        <ArrowLeft :size="16" /> Back to Products
      </Button>
    </header>

    <div class="edit-product-card card">
      <div class="card-header-clean">
        <h1 class="page-title">Edit Product</h1>
        <span
          class="status-indicator-badge"
          :class="status === 'published' ? 'status-indicator-badge--live' : 'status-indicator-badge--draft'"
        >
          <component :is="status === 'published' ? CheckCircle2 : FileText" :size="12" />
          {{ status === 'published' ? 'Published Live' : 'Draft Mode' }}
        </span>
      </div>

      <div class="form-fields">
        <!-- 1. Name & SKU -->
        <div class="form-group">
          <label class="form-label">Product Name *</label>
          <input v-model="name" type="text" class="form-input" placeholder="e.g. Classic Running Shoes" />
        </div>

        <!-- 2. Price, Real Stock Cost (COGS) & Category -->
        <div class="form-group-row">
          <div class="form-group flex-1">
            <label class="form-label">Selling Price (KES) *</label>
            <CurrencyInput v-model="price" />
          </div>

          <div class="form-group flex-1">
            <label class="form-label">Unit Stock Cost (COGS KES)</label>
            <CurrencyInput v-model="costPrice" placeholder="0" />
            <span class="field-hint">Used to calculate real gross profit.</span>
          </div>

          <div class="form-group flex-1">
            <label class="form-label">Category</label>
            <select v-model="categoryId" class="form-select">
              <option value="" disabled>Select category</option>
              <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- 3. SKU -->
        <div class="form-group">
          <label class="form-label">SKU / Barcode (Optional)</label>
          <input v-model="sku" type="text" class="form-input" placeholder="e.g. SH-RUN-01" />
        </div>

        <!-- 4. Interactive Status Toggle (Draft vs. Published) -->
        <div class="form-group status-selection-group">
          <label class="form-label">Storefront Visibility *</label>
          <div class="status-choice-grid">
            <button
              type="button"
              class="status-choice-btn"
              :class="{ 'status-choice-btn--active status-choice-btn--live': status === 'published' }"
              @click="status = 'published'"
            >
              <Globe :size="16" />
              <div class="choice-text">
                <strong>Published &amp; Live</strong>
                <span>Visible to shoppers on your public storefront catalog</span>
              </div>
            </button>

            <button
              type="button"
              class="status-choice-btn"
              :class="{ 'status-choice-btn--active status-choice-btn--draft': status === 'draft' }"
              @click="status = 'draft'"
            >
              <FileText :size="16" />
              <div class="choice-text">
                <strong>Draft Mode</strong>
                <span>Hidden from public store, recorded in internal stock only</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 5. Description -->
        <div class="form-group">
          <label class="form-label">Product Description (Optional)</label>
          <textarea
            v-model="description"
            class="form-textarea"
            rows="3"
            placeholder="Details on material, size, brand specifications..."
          />
        </div>

        <div class="form-actions">
          <Button variant="ghost" @click="router.push({ name: 'products' })">Cancel</Button>
          <Button variant="primary" size="lg" :loading="isSaving" @click="handleSave">Save Changes</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-product-page {
  padding: var(--space-6);
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.edit-product-card {
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.card-header-clean {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.page-title { font-size: var(--text-xl); font-weight: 700; }

.status-indicator-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--space-3);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 800;
}

.status-indicator-badge--live {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}

.status-indicator-badge--draft {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group-row {
  display: flex;
  gap: var(--space-3);
  flex-direction: column;
}

@media (min-width: 640px) {
  .form-group-row { flex-direction: row; }
}

.flex-1 { flex: 1; }

.form-label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.field-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 1px;
}

.form-input,
.form-select,
.form-textarea {
  min-height: 42px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--color-ink);
}

.form-textarea {
  padding: var(--space-3);
  resize: vertical;
}

/* Status Choice Buttons */
.status-choice-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin-top: 2px;
}

@media (max-width: 600px) {
  .status-choice-grid { grid-template-columns: 1fr; }
}

.status-choice-btn {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-standard);
}
.status-choice-btn:hover { border-color: var(--color-ink); }

.status-choice-btn--active {
  border-color: var(--color-ink);
  background: color-mix(in srgb, var(--color-ink) 6%, var(--color-surface));
}

.status-choice-btn--live.status-choice-btn--active {
  border-color: var(--color-ledger-green);
  background: color-mix(in srgb, var(--color-ledger-green) 8%, var(--color-surface));
}

.choice-text {
  display: flex;
  flex-direction: column;
}
.choice-text strong { font-size: var(--text-xs); color: var(--color-text); }
.choice-text span { font-size: 11px; color: var(--color-text-muted); margin-top: 1px; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>