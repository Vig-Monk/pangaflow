<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/DeliveryLocationStep.vue
// Complete location capture: GPS, debounced locality search, map pin & landmark form.
// =============================================================================

import { ref, computed } from 'vue';
import { apiGet } from '@/services/apiClient';
import LeafletPinPicker from './LeafletPinPicker.vue';
import Button from '@/components/ui/Button.vue';
import {
  Navigation,
  Search,
  MapPin,
  Building,
  Home,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  ShieldCheck,
} from 'lucide-vue-next';

export interface LocationPayload {
  customerLat: number | null;
  customerLng: number | null;
  locationSource: 'gps' | 'local_list' | 'nominatim' | 'manual_text';
  locationAccuracyM: number | null;
  fullAddress: string;
  estate: string;
  landmark: string;
  houseNumber: string;
}

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
  source: 'local_list' | 'nominatim';
  city?: string;
}

const props = defineProps<{
  initialData?: Partial<LocationPayload>;
}>();

const emit = defineEmits<{
  confirm: [payload: LocationPayload];
  back: [];
}>();

const mapRef = ref<InstanceType<typeof LeafletPinPicker> | null>(null);

// Form Fields
const estate = ref(props.initialData?.estate || '');
const landmark = ref(props.initialData?.landmark || '');
const houseNumber = ref(props.initialData?.houseNumber || '');

// GPS & Location Coordinates
const lat = ref<number | null>(props.initialData?.customerLat ?? null);
const lng = ref<number | null>(props.initialData?.customerLng ?? null);
const locationSource = ref<LocationPayload['locationSource']>(
  props.initialData?.locationSource || 'manual_text'
);
const locationAccuracyM = ref<number | null>(props.initialData?.locationAccuracyM ?? null);

// UI States
const isLocating = ref(false);
const gpsError = ref<string | null>(null);
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const isSearching = ref(false);
const showSearchResults = ref(false);
const isConfirmed = ref(false);
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

// Computed full combined delivery address string
const fullAddress = computed(() => {
  const parts = [
    estate.value.trim(),
    landmark.value.trim() ? `Near ${landmark.value.trim()}` : '',
    houseNumber.value.trim() ? `House/Door: ${houseNumber.value.trim()}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'Delivery Address';
});

const isFormValid = computed(() => {
  return estate.value.trim().length > 0 || (lat.value !== null && lng.value !== null);
});

// GPS Geolocation Handler
function handleUseCurrentLocation(): void {
  if (!navigator.geolocation) {
    gpsError.value = 'Geolocation is not supported by your browser. Please search or set your pin manually.';
    return;
  }

  isLocating.value = true;
  gpsError.value = null;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      isLocating.value = false;
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      lat.value = userLat;
      lng.value = userLng;
      locationAccuracyM.value = accuracy;
      locationSource.value = 'gps';

      if (!estate.value) {
        estate.value = 'Current GPS Location';
      }

      mapRef.value?.setCenter(userLat, userLng, 16);
    },
    (err) => {
      isLocating.value = false;
      if (err.code === err.PERMISSION_DENIED) {
        gpsError.value = 'Location permission was denied. You can still search your estate or tap the map to place your pin.';
      } else {
        gpsError.value = "Couldn't get an accurate GPS signal. Try searching your estate or placing your pin manually.";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );
}

// Search Handler (400ms debounce)
function handleSearchInput(): void {
  if (searchDebounce) clearTimeout(searchDebounce);

  const query = searchQuery.value.trim();
  if (query.length < 2) {
    searchResults.value = [];
    showSearchResults.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    try {
      const results = await apiGet<SearchResult[]>('/public/estates/search', { q: query });
      searchResults.value = results || [];
      showSearchResults.value = true;
    } catch {
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 400);
}

function selectSearchResult(result: SearchResult): void {
  lat.value = result.lat;
  lng.value = result.lng;
  locationSource.value = result.source;
  locationAccuracyM.value = null;
  estate.value = result.name;

  searchQuery.value = '';
  showSearchResults.value = false;

  mapRef.value?.setCenter(result.lat, result.lng, 15);
}

function handleMapPinUpdate(coords: { lat: number; lng: number }): void {
  lat.value = coords.lat;
  lng.value = coords.lng;
  locationSource.value = 'local_list';
  if (!estate.value) {
    estate.value = 'Selected Map Location';
  }
}

function handleConfirmStep(): void {
  isConfirmed.value = true;
  emit('confirm', {
    customerLat: lat.value,
    customerLng: lng.value,
    locationSource: locationSource.value,
    locationAccuracyM: locationAccuracyM.value,
    fullAddress: fullAddress.value,
    estate: estate.value.trim(),
    landmark: landmark.value.trim(),
    houseNumber: houseNumber.value.trim(),
  });
}
</script>

<template>
  <div class="delivery-location-step">
    <!-- View 1: Confirmed State Preview Card -->
    <div v-if="isConfirmed" class="confirmed-location-card card">
      <div class="confirmed-header">
        <div class="confirmed-title-row">
          <CheckCircle2 :size="20" class="text-teal" />
          <span class="confirmed-heading">Delivery Location Set</span>
        </div>
        <button type="button" class="edit-btn" @click="isConfirmed = false">
          <Edit2 :size="14" /> Change
        </button>
      </div>

      <div class="confirmed-body">
        <p class="address-preview">{{ fullAddress }}</p>
        <div class="meta-tag-row">
          <span v-if="lat && lng" class="meta-badge">
            <MapPin :size="12" /> Pin Selected ({{ lat.toFixed(4) }}, {{ lng.toFixed(4) }})
          </span>
          <span v-if="locationAccuracyM" class="meta-badge">
            Accuracy: ~{{ locationAccuracyM }}m
          </span>
        </div>
      </div>
    </div>

    <!-- View 2: Active Location Picker Workflow -->
    <div v-else class="active-picker-flow">
      <!-- 1. GPS Button with Privacy Trust Note -->
      <div class="gps-trigger-card">
        <div class="gps-button-row">
          <Button
            variant="secondary"
            class="gps-btn"
            :loading="isLocating"
            @click="handleUseCurrentLocation"
          >
            <Navigation :size="16" />
            <span>Use Current Location</span>
          </Button>
          <span class="gps-hint">Instant pin drop via device GPS</span>
        </div>

        <div class="privacy-note">
          <ShieldCheck :size="14" class="text-muted" />
          <span>Used exclusively for boda dispatch and accurate delivery distance calculation.</span>
        </div>

        <div v-if="gpsError" class="gps-error-alert">
          <AlertCircle :size="15" />
          <span>{{ gpsError }}</span>
        </div>
      </div>

      <!-- 2. Search Autocomplete -->
      <div class="search-section">
        <div class="search-field-wrap">
          <Search :size="16" class="search-icon text-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search estate, street or landmark (e.g. Kilimani, South C)..."
            class="search-input"
            @input="handleSearchInput"
            @focus="showSearchResults = searchResults.length > 0"
          />
          <RefreshCw v-if="isSearching" :size="14" class="search-spinner text-muted" />
        </div>

        <!-- Search Results Dropdown -->
        <ul v-if="showSearchResults && searchResults.length > 0" class="search-dropdown">
          <li
            v-for="(res, idx) in searchResults"
            :key="idx"
            class="dropdown-item"
            @click="selectSearchResult(res)"
          >
            <MapPin :size="14" class="text-teal" />
            <span class="dropdown-name">{{ res.name }}</span>
            <span class="dropdown-badge">{{ res.source === 'local_list' ? 'Locality' : 'Map' }}</span>
          </li>
        </ul>
      </div>

      <!-- 3. Leaflet Interactive Map -->
      <div class="map-wrapper">
        <LeafletPinPicker
          ref="mapRef"
          :lat="lat"
          :lng="lng"
          @update:location="handleMapPinUpdate"
        />
      </div>

      <!-- 4. Structured Landmark & House Number Micro-Form -->
      <div class="landmark-form card">
        <h4 class="form-title">Landmark & Building Specifics</h4>
        
        <div class="form-group">
          <label class="form-label">Estate / Area Name *</label>
          <div class="input-wrap">
            <MapPin :size="16" class="field-icon" />
            <input
              v-model="estate"
              type="text"
              placeholder="e.g. Kasarani, Seasons Area"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Building / Apartment / Landmark</label>
            <div class="input-wrap">
              <Building :size="16" class="field-icon" />
              <input
                v-model="landmark"
                type="text"
                placeholder="e.g. Palm Heights Flat, Opposite Quickmart"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group flex-1">
            <label class="form-label">House / Gate / Door #</label>
            <div class="input-wrap">
              <Home :size="16" class="field-icon" />
              <input
                v-model="houseNumber"
                type="text"
                placeholder="e.g. House B4, 2nd Floor"
                class="form-input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step Actions -->
      <div class="step-actions">
        <Button variant="ghost" @click="emit('back')">Back</Button>
        <Button
          variant="primary"
          :disabled="!isFormValid"
          @click="handleConfirmStep"
        >
          Confirm Location &amp; Continue
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.delivery-location-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
}

.active-picker-flow {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.gps-trigger-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.gps-button-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.gps-btn {
  min-height: 40px;
}

.gps-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.privacy-note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.gps-error-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  background: color-mix(in srgb, var(--color-market-clay) 10%, transparent);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.search-section {
  position: relative;
  width: 100%;
}

.search-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  pointer-events: none;
}

.search-spinner {
  position: absolute;
  right: var(--space-3);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-4) 0 calc(var(--space-8) + var(--space-2));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.search-input:focus { border-color: var(--color-ink); }

.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 200px;
  overflow-y: auto;
  z-index: 600;
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-text);
  transition: background var(--duration-fast) var(--ease-standard);
}
.dropdown-item:hover { background: var(--color-bg); }

.dropdown-name { flex: 1; }

.dropdown-badge {
  font-size: 10px;
  text-transform: uppercase;
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.landmark-form {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  flex-direction: column;
}

@media (min-width: 640px) {
  .form-row { flex-direction: row; }
}

.flex-1 { flex: 1; }

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--color-text-muted);
  pointer-events: none;
}

.form-input {
  width: 100%;
  min-height: 42px;
  padding: 0 var(--space-3) 0 calc(var(--space-8) + var(--space-1));
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}
.form-input:focus { border-color: var(--color-ink); }

.step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* Confirmed Card Styles */
.confirmed-location-card {
  background: color-mix(in srgb, var(--color-ledger-green) 8%, var(--color-surface));
  border: 1px solid var(--color-ledger-green);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.confirmed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.confirmed-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.confirmed-heading {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.edit-btn {
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.address-preview {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.meta-tag-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.text-teal { color: var(--color-ledger-green); }
</style>