<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/StoreSettingsView.vue
// =============================================================================

import { onMounted, ref, computed, reactive } from 'vue';
import { useStoreSettingsStore, type StoreSettings } from '@/stores/store';
import { useProductsStore } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import StoreHero from '@/components/storefront/StoreHero.vue';
import { Store, Eye, Edit3, Image as ImageIcon, Sparkles, CheckCircle2, Globe } from 'lucide-vue-next';

const storeSettingsStore = useStoreSettingsStore();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const form = reactive<StoreSettings>({
  name: '',
  slug: '',
  description: '',
  logo_url: '',
  cover_image_url: '',
  contact_phone: '',
  contact_email: '',
  location: '',
  delivery_info: '',
  status: 'draft',
  hero_layout: 'editorial',
  hero_headline: '',
  hero_subheadline: '',
  hero_cta_label: 'Shop Now',
});

const activeTab = ref<'customize' | 'preview'>('customize');
const isSaving = ref(false);
const logoUploading = ref(false);
const coverUploading = ref(false);
const showPublishCelebration = ref(false);

onMounted(async () => {
  await storeSettingsStore.fetchSettings();
  if (storeSettingsStore.settings) {
    const s = storeSettingsStore.settings;
    form.name = s.name || '';
    form.slug = s.slug || '';
    form.description = s.description ?? '';
    form.logo_url = s.logo_url ?? '';
    form.cover_image_url = s.cover_image_url ?? '';
    form.contact_phone = s.contact_phone ?? '';
    form.contact_email = s.contact_email ?? '';
    form.location = s.location ?? '';
    form.delivery_info = s.delivery_info ?? '';
    form.status = s.status === 'published' ? 'published' : 'draft';
    form.hero_layout = (s.hero_layout as any) || 'editorial';
    form.hero_headline = s.hero_headline ?? '';
    form.hero_subheadline = s.hero_subheadline ?? '';
    form.hero_cta_label = s.hero_cta_label ?? 'Shop Now';
  }
});

const isNewStore = computed(() => !storeSettingsStore.settings?.id);
const wasPreviouslyDraft = computed(() => storeSettingsStore.settings?.status !== 'published');

const publicStorefrontUrl = computed(() => {
  if (!form.slug) return '#';
  return `${window.location.origin}/store/${form.slug.trim().toLowerCase()}`;
});

async function uploadImage(event: Event, targetType: 'logo' | 'cover'): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (targetType === 'logo') logoUploading.value = true;
  else coverUploading.value = true;

  try {
    const sigResult = await productsStore.getUploadSignature('store');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigResult.apiKey);
    formData.append('timestamp', String(sigResult.timestamp));
    formData.append('signature', sigResult.signature);
    formData.append('folder', sigResult.folder);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigResult.cloudName}/image/upload`;
    const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Cloudinary image upload failed');
    }

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error('No image URL returned from provider');
    }

    if (targetType === 'logo') {
      form.logo_url = data.secure_url;
    } else {
      form.cover_image_url = data.secure_url;
    }

    pushToast({ message: `${targetType === 'logo' ? 'Logo' : 'Cover image'} uploaded successfully`, variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to upload image', variant: 'error' });
  } finally {
    if (targetType === 'logo') logoUploading.value = false;
    else coverUploading.value = false;
    target.value = '';
  }
}

async function handleSave(): Promise<void> {
  if (!form.name.trim() || !form.slug.trim()) {
    pushToast({ message: 'Store Name and address Slug are required', variant: 'error' });
    return;
  }

  isSaving.value = true;
  try {
    const isTransitioningToLive = form.status === 'published' && wasPreviouslyDraft.value;

    await storeSettingsStore.saveSettings({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description?.trim() || null,
      logo_url: form.logo_url || null,
      cover_image_url: form.cover_image_url || null,
      contact_phone: form.contact_phone?.trim() || null,
      contact_email: form.contact_email?.trim() || null,
      location: form.location?.trim() || null,
      delivery_info: form.delivery_info?.trim() || null,
      status: form.status,
      hero_layout: form.hero_layout || 'editorial',
      hero_headline: form.hero_headline?.trim() || null,
      hero_subheadline: form.hero_subheadline?.trim() || null,
      hero_cta_label: form.hero_cta_label?.trim() || null,
    });

    if (isTransitioningToLive) {
      showPublishCelebration.value = true;
    } else {
      pushToast({ message: 'Store configurations saved', variant: 'success' });
    }
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Save failed', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="customize-store-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Customize your store</h1>
        <p class="page-subtitle">Personalize your brand identity, merchandising layout, and contact channels.</p>
      </div>
      <div class="header-actions-row">
        <div class="mobile-tab-toggle">
          <button :class="['tab-btn', { active: activeTab === 'customize' }]" @click="activeTab = 'customize'">
            <Edit3 :size="15" /> Edit
          </button>
          <button :class="['tab-btn', { active: activeTab === 'preview' }]" @click="activeTab = 'preview'">
            <Eye :size="15" /> Preview
          </button>
        </div>

        <a v-if="!isNewStore" :href="publicStorefrontUrl" target="_blank" class="view-store-link">
          <Button variant="secondary">View Live Store ↗</Button>
        </a>
      </div>
    </header>

    <Transition name="fade-banner">
      <div v-if="showPublishCelebration" class="publish-celebration-banner card">
        <div class="celebration-content">
          <CheckCircle2 :size="28" class="text-teal" />
          <div>
            <h3>Your store is now live!</h3>
            <p>Shoppers can now browse your catalog and place orders via your public link.</p>
          </div>
        </div>
        <div class="celebration-actions">
          <a :href="publicStorefrontUrl" target="_blank" class="celebration-link-btn">
            <Button variant="primary" size="sm">Open Storefront <Globe :size="14" /></Button>
          </a>
          <button class="dismiss-banner-btn" type="button" @click="showPublishCelebration = false">Dismiss</button>
        </div>
      </div>
    </Transition>

    <div class="workspace-grid">
      <div :class="['workspace-controls', { 'mobile-hidden': activeTab === 'preview' }]">
        
        <!-- CARD 1: APPEARANCE -->
        <section class="section-card card">
          <div class="card-heading">
            <Sparkles :size="20" class="card-icon" />
            <h2>Appearance &amp; Merchandising</h2>
          </div>

          <div class="upload-sections-row">
            <div class="media-group">
              <label class="form-label">Store Logo</label>
              <div class="logo-box">
                <img v-if="form.logo_url" :src="form.logo_url" alt="Logo preview" class="logo-preview" />
                <Store v-else :size="24" class="text-muted" />
                <input type="file" id="logo-input" accept="image/*" class="hidden-input" @change="uploadImage($event, 'logo')" />
                <label for="logo-input" class="upload-overlay-btn" :class="{ disabled: logoUploading }">
                  {{ logoUploading ? 'Uploading...' : 'Change Logo' }}
                </label>
              </div>
            </div>

            <div class="media-group flex-1">
              <label class="form-label">Cover Banner</label>
              <div class="cover-box">
                <img v-if="form.cover_image_url" :src="form.cover_image_url" alt="Cover preview" class="cover-preview" />
                <ImageIcon v-else :size="24" class="text-muted" />
                <input type="file" id="cover-input" accept="image/*" class="hidden-input" @change="uploadImage($event, 'cover')" />
                <label for="cover-input" class="upload-overlay-btn" :class="{ disabled: coverUploading }">
                  {{ coverUploading ? 'Uploading...' : 'Change Banner' }}
                </label>
              </div>
            </div>
          </div>

          <div class="form-group-row">
            <div class="form-group flex-1">
              <label class="form-label">Store Name *</label>
              <input v-model="form.name" type="text" placeholder="e.g. Joy's Boutique" class="form-input" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Store URL Slug * (soko.app/store/...)</label>
              <input v-model="form.slug" type="text" placeholder="joys-boutique" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Brand Description</label>
            <textarea v-model="form.description" placeholder="A short description about your brand identity" class="form-textarea" rows="2" />
          </div>

          <div class="form-group">
            <label class="form-label">Hero Layout Style</label>
            <select v-model="form.hero_layout" class="form-select">
              <option value="editorial">Editorial (Centered Large Image)</option>
              <option value="split">Split Layout (Image &amp; Text Side-by-Side)</option>
              <option value="minimal">Minimal Typography Lead</option>
              <option value="promotional">Promotional Banner Overlay</option>
            </select>
          </div>

          <div class="form-group-row">
            <div class="form-group flex-1">
              <label class="form-label">Hero Headline</label>
              <input v-model="form.hero_headline" type="text" placeholder="Fresh arrivals daily" class="form-input" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Call to Action (CTA) Label</label>
              <input v-model="form.hero_cta_label" type="text" placeholder="Shop Now" class="form-input" />
            </div>
          </div>
        </section>

        <!-- CARD 2: STORE INFORMATION -->
        <section class="section-card card">
          <div class="card-heading">
            <Store :size="20" class="card-icon" />
            <h2>Store Information</h2>
          </div>

          <div class="form-group-row">
            <div class="form-group flex-1">
              <label class="form-label">Contact Phone</label>
              <input v-model="form.contact_phone" type="tel" placeholder="07XXXXXXXX" class="form-input" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Contact Email</label>
              <input v-model="form.contact_email" type="email" placeholder="contact@shop.com" class="form-input" />
            </div>
          </div>

          <div class="form-group-row">
            <div class="form-group flex-1">
              <label class="form-label">Physical Location Address</label>
              <input v-model="form.location" type="text" placeholder="Wakulima Market, Nairobi" class="form-input" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Delivery Policy Info</label>
              <input v-model="form.delivery_info" type="text" placeholder="Boda delivery across CBD KES 200" class="form-input" />
            </div>
          </div>
        </section>

        <!-- CARD 3: PUBLISHING -->
        <section class="section-card card publishing-card" :class="{ 'card-published-active': form.status === 'published' }">
          <div class="card-heading">
            <Globe :size="20" class="card-icon" />
            <h2>Publishing Status</h2>
          </div>

          <div class="toggle-row">
            <label class="toggle-choice">
              <input type="radio" value="draft" v-model="form.status" />
              <div class="choice-box">
                <span class="choice-indicator"></span>
                <div>
                  <p class="choice-title">Draft Mode</p>
                  <p class="choice-desc">Storefront is hidden and offline from public catalogs.</p>
                </div>
              </div>
            </label>
            <label class="toggle-choice">
              <input type="radio" value="published" v-model="form.status" />
              <div class="choice-box">
                <span class="choice-indicator"></span>
                <div>
                  <p class="choice-title">Published &amp; Live</p>
                  <p class="choice-desc">Storefront catalog is live, active, and accessible to shoppers.</p>
                </div>
              </div>
            </label>
          </div>
        </section>

        <div class="submit-action-row">
          <Button variant="primary" size="lg" :loading="isSaving" @click="handleSave">Save Changes</Button>
        </div>
      </div>

      <!-- RIGHT COLUMN: Live Interactive Storefront Preview -->
      <div :class="['workspace-preview-pane card', { 'mobile-hidden': activeTab === 'customize' }]">
        <div class="preview-pane-bar">
          <span class="preview-indicator-dot" :class="{ 'dot-live': form.status === 'published' }"></span>
          <span class="preview-bar-title">Live Preview Window ({{ form.status.toUpperCase() }})</span>
        </div>

        <div class="preview-device-frame">
          <div class="preview-mini-header">
            <div class="preview-brand-slot">
              <img v-if="form.logo_url" :src="form.logo_url" class="preview-mini-logo" alt="Logo" />
              <Store v-else :size="18" class="text-muted" />
              <span class="preview-mini-name">{{ form.name || 'Store Name' }}</span>
            </div>
            <div class="preview-mini-cart">🛒</div>
          </div>

          <!-- Real StoreHero component bound to reactive local preview form state -->
          <div class="preview-hero-wrapper">
            <StoreHero :settings="form" />
          </div>

          <div class="preview-mini-catalog-hint">
            <p>Catalog product grid dynamically updates upon publishing changes.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.customize-store-page {
  padding: var(--space-6);
  max-width: 1300px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }

.header-actions-row { display: flex; align-items: center; gap: var(--space-3); }

.mobile-tab-toggle {
  display: flex;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 3px;
}

@media (min-width: 1024px) { .mobile-tab-toggle { display: none; } }

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.tab-btn.active { background: var(--color-ink); color: var(--color-text-inverse); }

.publish-celebration-banner {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, var(--color-surface));
  border: 1px solid var(--color-ledger-green);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  margin-bottom: var(--space-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.celebration-content { display: flex; align-items: center; gap: var(--space-4); }
.celebration-content h3 { font-size: var(--text-base); font-weight: 600; color: var(--color-text); }
.celebration-content p { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }

.celebration-actions { display: flex; align-items: center; gap: var(--space-3); }
.celebration-link-btn { text-decoration: none; }
.dismiss-banner-btn { background: transparent; border: none; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); cursor: pointer; }
.dismiss-banner-btn:hover { color: var(--color-text); }

.fade-banner-enter-active, .fade-banner-leave-active { transition: opacity var(--duration-base) var(--ease-standard); }
.fade-banner-enter-from, .fade-banner-leave-to { opacity: 0; }

.workspace-grid { display: flex; gap: var(--space-6); align-items: flex-start; }
.workspace-controls { flex: 1.2; display: flex; flex-direction: column; gap: var(--space-5); }
.workspace-preview-pane {
  flex: 1;
  position: sticky;
  top: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 1023px) { .mobile-hidden { display: none !important; } }

.section-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.publishing-card { transition: border-color var(--duration-base) var(--ease-standard); }
.card-published-active { border-color: var(--color-ledger-green); }

.card-heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-lg);
}
.card-icon { color: var(--color-ink); }

.form-group { display: flex; flex-direction: column; gap: var(--space-1); }
.form-group-row { display: flex; gap: var(--space-4); flex-direction: column; }
@media (min-width: 640px) { .form-group-row { flex-direction: row; } }
.flex-1 { flex: 1; }

.form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); }
.form-input, .form-textarea, .form-select {
  min-height: 44px; padding: 0 var(--space-4);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text); outline: none;
}
.form-textarea { padding: var(--space-3) var(--space-4); resize: vertical; }

.upload-sections-row { display: flex; gap: var(--space-4); flex-direction: column; }
@media (min-width: 640px) { .upload-sections-row { flex-direction: row; } }

.media-group { display: flex; flex-direction: column; gap: var(--space-2); }
.logo-box, .cover-box {
  position: relative; height: 110px; background: var(--color-bg);
  border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;
  overflow: hidden; border: 1px solid var(--color-border);
}
.logo-box { width: 110px; }
.logo-preview, .cover-preview { width: 100%; height: 100%; object-fit: cover; }
.hidden-input { display: none; }

.upload-overlay-btn {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: color-mix(in srgb, var(--color-ink) 85%, black);
  color: var(--color-text-inverse);
  font-size: var(--text-xs); font-weight: 600; text-align: center; padding: var(--space-2) 0; cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-standard);
}
.upload-overlay-btn.disabled { opacity: 0.5; cursor: not-allowed; }

.toggle-row { display: flex; flex-direction: column; gap: var(--space-3); }
@media (min-width: 640px) { .toggle-row { flex-direction: row; } }
.toggle-choice { flex: 1; cursor: pointer; }
.toggle-choice input { display: none; }
.choice-box {
  display: flex; gap: var(--space-3); align-items: flex-start;
  padding: var(--space-4); background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); transition: border-color var(--duration-fast) var(--ease-standard);
}
.toggle-choice input:checked + .choice-box {
  border-color: var(--color-ink); background: color-mix(in srgb, var(--color-ink) 5%, transparent);
}
.choice-indicator {
  width: 16px; height: 16px; border: 2px solid var(--color-border);
  border-radius: 50%; display: inline-block; flex-shrink: 0; position: relative; margin-top: 2px;
}
.toggle-choice input:checked + .choice-box .choice-indicator { border-color: var(--color-ink); }
.toggle-choice input:checked + .choice-box .choice-indicator::after {
  content: ''; position: absolute; width: 8px; height: 8px; background: var(--color-ink);
  border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
}
.choice-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.choice-desc { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }

.submit-action-row { display: flex; justify-content: flex-end; }

.preview-pane-bar { display: flex; align-items: center; gap: var(--space-2); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3); }
.preview-indicator-dot { width: 8px; height: 8px; background: var(--color-market-clay); border-radius: 50%; }
.dot-live { background: var(--color-ledger-green); }
.preview-bar-title { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.preview-device-frame { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; }
.preview-mini-header { background: var(--color-surface); padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); }
.preview-brand-slot { display: flex; align-items: center; gap: var(--space-2); }
.preview-mini-logo { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
.preview-mini-name { font-size: var(--text-sm); font-weight: 600; }
.preview-mini-cart { font-size: 14px; }

.preview-hero-wrapper {
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}

.preview-mini-catalog-hint { padding: var(--space-4); text-align: center; font-size: var(--text-xs); color: var(--color-text-muted); }
.text-teal { color: var(--color-ledger-green);}
</style>