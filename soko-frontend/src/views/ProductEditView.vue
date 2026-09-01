<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductEditView.vue
// Product edit form with Option Builder, Matrix Generator, and Live Status controls.
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProductsStore, type CreateVariantInput } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPatch } from '@/services/apiClient';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  X,
} from 'lucide-vue-next';

interface OptionDef {
  name: string;
  valueInput: string;
  values: string[];
}

interface EditableVariant {
  id?: string;
  title: string;
  sku: string;
  options: Record<string, string>;
  price: number;
  cost_price: number;
  stock: number;
  low_stock_at: number;
  image_url: string | null;
  is_active: boolean;
}

const route = useRoute();
const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const productId = route.params.id as string;

// Base product fields
const name = ref('');
const price = ref(0);
const costPrice = ref(0);
const sku = ref('');
const description = ref('');
const categoryId = ref('');
const status = ref<'draft' | 'published'>('published');
const isSaving = ref(false);

// Product Variants state
const hasVariants = ref(false);
const optionDefs = ref<OptionDef[]>([]);
const variantMatrix = ref<EditableVariant[]>([]);

// Bulk fill toolbar values
const bulkVariantPrice = ref<number | null>(null);
const bulkVariantCost = ref<number | null>(null);
const bulkVariantStock = ref<number | null>(null);

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

    // Populate existing variants if product has them
    if (prod.variants && prod.variants.length > 0) {
      hasVariants.value = true;
      variantMatrix.value = prod.variants.map((v: any) => ({
        id: v.id,
        title: v.title,
        sku: v.sku || '',
        options: v.options || {},
        price: parseFloat(v.price),
        cost_price: parseFloat(v.cost_price || '0'),
        stock: v.stock,
        low_stock_at: v.low_stock_at || 5,
        image_url: v.image_url || null,
        is_active: v.is_active ?? true,
      }));

      // Extract unique option dimensions from variant records
      const dims: Record<string, string[]> = {};
      prod.variants.forEach((v: any) => {
        if (v.options) {
          Object.entries(v.options).forEach(([k, val]: [string, any]) => {
            if (!dims[k]) dims[k] = [];
            if (!dims[k].includes(val)) dims[k].push(val);
          });
        }
      });

      optionDefs.value = Object.entries(dims).map(([dimName, values]) => ({
        name: dimName,
        valueInput: '',
        values,
      }));
    }
  } catch {
    pushToast({ message: 'Failed to load product details', variant: 'error' });
    router.push({ name: 'products' });
  }
});

// Option Builder Methods
function addOptionDef(): void {
  if (optionDefs.value.length >= 3) {
    pushToast({ message: 'Maximum 3 option dimensions allowed (e.g. Size, Color, Flavor)', variant: 'info' });
    return;
  }
  optionDefs.value.push({ name: '', valueInput: '', values: [] });
}

function addValueToOption(opt: OptionDef): void {
  const trimmed = opt.valueInput.trim().replace(/,/g, '');
  if (trimmed && !opt.values.includes(trimmed)) {
    opt.values.push(trimmed);
    opt.valueInput = '';
    generateMatrix();
  }
}

function removeValueFromOption(opt: OptionDef, val: string): void {
  opt.values = opt.values.filter((v) => v !== val);
  generateMatrix();
}

function removeOptionDef(index: number): void {
  optionDefs.value.splice(index, 1);
  if (optionDefs.value.length === 0) {
    variantMatrix.value = [];
  } else {
    generateMatrix();
  }
}

// Generates Cartesian Product Matrix
function generateMatrix(): void {
  const validDefs = optionDefs.value.filter((d) => d.name.trim() && d.values.length > 0);
  if (validDefs.length === 0) {
    variantMatrix.value = [];
    return;
  }

  const cartesian = (arrays: string[][]): string[][] => {
    return arrays.reduce((acc, curr) => {
      return acc.flatMap((a) => curr.map((c) => [...a, c]));
    }, [[]] as string[][]);
  };

  const combinations = cartesian(validDefs.map((d) => d.values));

  const newMatrix: EditableVariant[] = combinations.map((combo) => {
    const optionsObj: Record<string, string> = {};
    validDefs.forEach((def, i) => {
      optionsObj[def.name.trim()] = combo[i];
    });
    const title = Object.values(optionsObj).join(' / ');

    // Preserve existing custom inputs if this combination was already configured
    const existing = variantMatrix.value.find((v) => {
      return validDefs.every((def) => v.options[def.name.trim()] === optionsObj[def.name.trim()]);
    });

    return {
      id: existing?.id,
      title,
      sku: existing?.sku || `${sku.value ? `${sku.value}-` : ''}${combo.join('-')}`.toUpperCase(),
      options: optionsObj,
      price: existing?.price !== undefined ? existing.price : (price.value || 0),
      cost_price: existing?.cost_price !== undefined ? existing.cost_price : (costPrice.value || 0),
      stock: existing?.stock !== undefined ? existing.stock : 5,
      low_stock_at: existing?.low_stock_at !== undefined ? existing.low_stock_at : 5,
      image_url: existing?.image_url || null,
      is_active: true,
    };
  });

  variantMatrix.value = newMatrix;
}

function applyBulkVariantValues(): void {
  if (variantMatrix.value.length === 0) return;
  variantMatrix.value.forEach((v) => {
    if (bulkVariantPrice.value !== null && bulkVariantPrice.value >= 0) {
      v.price = bulkVariantPrice.value;
    }
    if (bulkVariantCost.value !== null && bulkVariantCost.value >= 0) {
      v.cost_price = bulkVariantCost.value;
    }
    if (bulkVariantStock.value !== null && bulkVariantStock.value >= 0) {
      v.stock = bulkVariantStock.value;
    }
  });
  pushToast({ message: `Applied bulk values across ${variantMatrix.value.length} variants`, variant: 'info' });
}

async function handleSave(): Promise<void> {
  if (!name.value.trim() || price.value < 0) return;

  isSaving.value = true;
  try {
    const formattedVariants: CreateVariantInput[] = hasVariants.value
      ? variantMatrix.value.map((v) => ({
          id: v.id,
          title: v.title.trim(),
          sku: v.sku?.trim() || null,
          options: v.options,
          price: Number(v.price),
          cost_price: Number(v.cost_price || 0),
          stock: Number(v.stock),
          low_stock_at: Number(v.low_stock_at || 5),
          image_url: v.image_url || null,
          is_active: v.is_active ?? true,
        }))
      : [];

    await apiPatch(`/products/${productId}`, {
      name: name.value.trim(),
      price: Number(price.value),
      cost_price: Number(costPrice.value) || null,
      sku: sku.value.trim() || null,
      description: description.value.trim() || null,
      category_id: categoryId.value || undefined,
      status: status.value,
      variants: formattedVariants,
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
        <!-- 1. Name -->
        <div class="form-group">
          <label class="form-label">Product Name *</label>
          <input v-model="name" type="text" class="form-input" placeholder="e.g. Classic Running Shoes" />
        </div>

        <!-- 2. Base Price, Real Stock Cost (COGS) & Category -->
        <div class="form-group-row">
          <div class="form-group flex-1">
            <label class="form-label">Base Selling Price (KES) *</label>
            <CurrencyInput v-model="price" />
          </div>

          <div class="form-group flex-1">
            <label class="form-label">Base Unit Stock Cost (COGS KES)</label>
            <CurrencyInput v-model="costPrice" placeholder="0" />
            <span class="field-hint">Used for gross profit margin calculations.</span>
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

        <!-- 5. PRODUCT VARIANTS & MATRIX BUILDER -->
        <div class="variants-config-box card">
          <div class="variants-header-row">
            <div class="header-left">
              <Layers :size="18" class="text-ink" />
              <div>
                <h3 class="variants-heading">Product Options &amp; Variants</h3>
                <p class="variants-subtext">Configure sizes, colors, flavors, or packaging options with individual prices &amp; stock.</p>
              </div>
            </div>

            <label class="variant-toggle-label">
              <input type="checkbox" v-model="hasVariants" @change="() => { if (hasVariants && optionDefs.length === 0) addOptionDef(); }" />
              <span>Enable Options</span>
            </label>
          </div>

          <template v-if="hasVariants">
            <!-- Option Dimensions Builder -->
            <div class="option-builder-stack">
              <div
                v-for="(opt, idx) in optionDefs"
                :key="idx"
                class="option-def-card"
              >
                <div class="def-header-row">
                  <span class="def-num">Option {{ idx + 1 }}</span>
                  <button type="button" class="remove-def-btn" @click="removeOptionDef(idx)">
                    <Trash2 :size="13" /> Remove
                  </button>
                </div>

                <div class="def-fields-row">
                  <div class="def-name-wrap">
                    <label class="field-micro-label">Option Name</label>
                    <input
                      v-model="opt.name"
                      type="text"
                      placeholder="e.g. Size, Color, Flavor"
                      class="form-input form-input--sm"
                      @blur="generateMatrix"
                    />
                  </div>

                  <div class="def-values-wrap">
                    <label class="field-micro-label">Add Values (Type and press Enter or comma)</label>
                    <div class="tags-input-box">
                      <span v-for="val in opt.values" :key="val" class="value-tag">
                        {{ val }}
                        <button type="button" class="tag-del-btn" @click="removeValueFromOption(opt, val)">
                          <X :size="11" />
                        </button>
                      </span>
                      <input
                        v-model="opt.valueInput"
                        type="text"
                        placeholder="e.g. Small"
                        class="tag-input-field"
                        @keydown.enter.prevent="addValueToOption(opt)"
                        @keydown="($event.key === ',' || $event.key === 'Tab') ? ($event.preventDefault(), addValueToOption(opt)) : null"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                v-if="optionDefs.length < 3"
                variant="secondary"
                size="sm"
                class="add-opt-btn"
                @click="addOptionDef"
              >
                <Plus :size="14" /> Add Another Option Dimension (e.g. Color)
              </Button>
            </div>

            <!-- Bulk Fill Toolbar for Matrix -->
            <div v-if="variantMatrix.length > 0" class="matrix-bulk-toolbar card">
              <div class="bulk-title-wrap">
                <Sparkles :size="14" class="text-gold" />
                <span>Bulk Set All Variants ({{ variantMatrix.length }} SKUs):</span>
              </div>

              <div class="bulk-inputs-row">
                <input v-model.number="bulkVariantPrice" type="number" min="0" placeholder="Price KES" class="toolbar-mini-input" />
                <input v-model.number="bulkVariantCost" type="number" min="0" placeholder="Cost KES" class="toolbar-mini-input" />
                <input v-model.number="bulkVariantStock" type="number" min="0" placeholder="Stock Qty" class="toolbar-mini-input" />
                <Button variant="secondary" size="sm" @click="applyBulkVariantValues">Apply to All</Button>
              </div>
            </div>

            <!-- Variant Combinations Matrix Table -->
            <div v-if="variantMatrix.length > 0" class="matrix-table-wrap">
              <table class="matrix-table">
                <thead>
                  <tr>
                    <th>Variant Combination</th>
                    <th>SKU Code</th>
                    <th class="text-right">Selling Price (KES) *</th>
                    <th class="text-right">Unit Cost (COGS)</th>
                    <th class="text-right">Stock Qty *</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(v, i) in variantMatrix" :key="i">
                    <td class="font-bold">{{ v.title }}</td>
                    <td>
                      <input v-model="v.sku" type="text" placeholder="SKU" class="table-cell-input" />
                    </td>
                    <td class="text-right">
                      <input v-model.number="v.price" type="number" min="0" class="table-cell-input text-right font-mono" />
                    </td>
                    <td class="text-right">
                      <input v-model.number="v.cost_price" type="number" min="0" class="table-cell-input text-right font-mono text-muted" />
                    </td>
                    <td class="text-right">
                      <input v-model.number="v.stock" type="number" min="0" class="table-cell-input text-right font-mono" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- 6. Description -->
        <div class="form-group">
          <label class="form-label">Product Description (Optional)</label>
          <textarea
            v-model="description"
            class="form-textarea"
            rows="3"
            placeholder="Details on material, size, care specifications..."
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
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-16);
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

.form-input--sm {
  min-height: 36px;
  font-size: var(--text-xs);
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

/* Variants Section */
.variants-config-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.variants-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.variants-heading {
  font-size: var(--text-sm);
  font-weight: 700;
}

.variants-subtext {
  font-size: 11px;
  color: var(--color-text-muted);
}

.variant-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
}

.option-builder-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.option-def-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.def-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.def-num {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.remove-def-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-market-clay);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.def-fields-row {
  display: flex;
  gap: var(--space-3);
  flex-direction: column;
	}
@media (min-width: 640px) {
  .def-fields-row { flex-direction: row; }
}

.def-name-wrap { width: 100%; max-width: 200px; }
.def-values-wrap { flex: 1; }

.field-micro-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  margin-bottom: 2px;
  display: block;
}

.tags-input-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px var(--space-2);
  min-height: 36px;
}

.value-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
}

.tag-del-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  display: flex;
  align-items: center;
}
.tag-del-btn:hover { color: var(--color-market-clay); }

.tag-input-field {
  border: none;
  background: transparent;
  outline: none;
  font-size: var(--text-xs);
  flex: 1;
  min-width: 80px;
  padding: 2px;
}

.add-opt-btn {
  align-self: flex-start;
}

/* Bulk Toolbar */
.matrix-bulk-toolbar {
  background: color-mix(in srgb, var(--color-ink) 5%, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.bulk-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
}

.bulk-inputs-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.toolbar-mini-input {
  width: 90px;
  min-height: 32px;
  padding: 0 var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  outline: none;
}

/* Matrix Table */
.matrix-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: var(--text-xs);
}

.matrix-table th {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.matrix-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.table-cell-input {
  width: 100%;
  min-height: 32px;
  padding: 0 var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text);
  outline: none;
}
.table-cell-input:focus { border-color: var(--color-ink); }

.text-right { text-align: right; }
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.text-gold { color: var(--color-gold-hover); }
</style>