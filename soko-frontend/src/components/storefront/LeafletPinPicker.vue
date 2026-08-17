<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/LeafletPinPicker.vue
// Zero-cost Leaflet + OpenStreetMap interactive pin picker with SVG marker.
// =============================================================================

import { onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  lat: null,
  lng: null,
  zoom: 14,
  readonly: false,
});

const emit = defineEmits<{
  'update:location': [coords: { lat: number; lng: number }];
}>();

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let marker: L.Marker | null = null;

// Default fallback to Nairobi Center if no initial coordinates are passed
const DEFAULT_LAT = -1.286389;
const DEFAULT_LNG = 36.817223;

// SVG Pin to eliminate Leaflet image asset path bundling bugs in Vite
const pinIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `
    <div class="pin-marker-wrapper">
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.611 0 0 7.611 0 17C0 29.75 17 44 17 44C17 44 34 29.75 34 17C34 7.611 26.389 0 17 0Z" fill="#D91E4E"/>
        <circle cx="17" cy="17" r="7" fill="#FFFFFF"/>
      </svg>
      <div class="pin-shadow"></div>
    </div>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

function initMap(): void {
  if (!mapContainer.value) return;

  const initialCenter: [number, number] = [
    props.lat ?? DEFAULT_LAT,
    props.lng ?? DEFAULT_LNG,
  ];

  map = L.map(mapContainer.value, {
    center: initialCenter,
    zoom: props.zoom,
    scrollWheelZoom: false, // Prevents scroll hijacking on mobile touch
    attributionControl: true,
  });

  // Free OpenStreetMap Tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);

  if (props.lat !== null && props.lng !== null) {
    createOrUpdateMarker(props.lat, props.lng);
  }

  if (!props.readonly) {
    // Map Click sets Pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      createOrUpdateMarker(lat, lng);
      emit('update:location', { lat: roundCoord(lat), lng: roundCoord(lng) });
    });
  }

  // Handle map rendering when mounted inside hidden tabs/transitions
  setTimeout(() => {
    map?.invalidateSize();
  }, 250);
}

function roundCoord(val: number): number {
  return Math.round(val * 1000000) / 1000000;
}

function createOrUpdateMarker(lat: number, lng: number): void {
  if (!map) return;

  if (!marker) {
    marker = L.marker([lat, lng], {
      icon: pinIcon,
      draggable: !props.readonly,
    }).addTo(map);

    if (!props.readonly) {
      marker.on('dragend', () => {
        if (!marker) return;
        const position = marker.getLatLng();
        emit('update:location', {
          lat: roundCoord(position.lat),
          lng: roundCoord(position.lng),
        });
      });
    }
  } else {
    marker.setLatLng([lat, lng]);
  }
}

export function setCenter(lat: number, lng: number, zoomLevel = 15): void {
  if (!map) return;
  map.setView([lat, lng], zoomLevel);
  createOrUpdateMarker(lat, lng);
}

watch(
  () => [props.lat, props.lng],
  ([newLat, newLng]) => {
    if (newLat !== null && newLng !== null && typeof newLat === 'number' && typeof newLng === 'number') {
      if (map) {
        setCenter(newLat, newLng);
      }
    }
  }
);

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
    marker = null;
  }
});

defineExpose({
  setCenter,
});
</script>

<template>
  <div class="leaflet-map-wrapper">
    <div ref="mapContainer" class="leaflet-map-canvas"></div>
    <div v-if="!readonly" class="map-touch-hint">
      <span>Tap or drag marker to set exact delivery pin</span>
    </div>
  </div>
</template>

<style>
/* Leaflet custom SVG marker styles */
.custom-leaflet-pin {
  background: transparent;
  border: none;
}
.pin-marker-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pin-marker-wrapper svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
.pin-shadow {
  width: 14px;
  height: 4px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 50%;
  margin-top: -2px;
  filter: blur(1px);
}
</style>

<style scoped>
.leaflet-map-wrapper {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.leaflet-map-canvas {
  width: 100%;
  height: 280px;
  z-index: 1;
}

@media (min-width: 640px) {
  .leaflet-map-canvas {
    height: 320px;
  }
}

.map-touch-hint {
  position: absolute;
  bottom: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.85);
  color: #FFFFFF;
  font-size: var(--text-xs);
  padding: 3px var(--space-3);
  border-radius: var(--radius-full);
  z-index: 500;
  pointer-events: none;
  white-space: nowrap;
  font-weight: 500;
}
</style>