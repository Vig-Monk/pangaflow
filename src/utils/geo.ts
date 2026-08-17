// =============================================================================
// src/utils/geo.ts
// Server-authoritative zero-cost geometry and distance calculations.
// =============================================================================

export interface DeliveryFeeConfig {
  baseFee?: number;            // Base delivery fee in KES (default: 100)
  feePerKm?: number;           // Surcharge per km beyond base threshold in KES (default: 25)
  baseThresholdKm?: number;    // Distance included in base fee (default: 3 km)
  maxDeliveryRadiusKm?: number; // Maximum radius the merchant delivers to (default: 15 km)
}

export interface DeliveryFeeCalculation {
  fee: number;
  status: 'known' | 'needs_merchant_confirmation';
  distanceKm: number;
}

/**
 * Computes the spherical distance in kilometers between two sets of GPS coordinates
 * using the Haversine formula (pure server-side math, zero external API costs).
 */
export function computeHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  // Quick return for identical coordinates
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Calculates the delivery fee based on computed distance and merchant tier configurations.
 * If distance exceeds the maximum delivery radius or is indeterminate, flags for merchant confirmation.
 */
export function calculateDeliveryFee(
  distanceKm: number,
  config: DeliveryFeeConfig = {}
): DeliveryFeeCalculation {
  const baseFee = config.baseFee ?? 100;
  const feePerKm = config.feePerKm ?? 25;
  const baseThresholdKm = config.baseThresholdKm ?? 3;
  const maxDeliveryRadiusKm = config.maxDeliveryRadiusKm ?? 15;

  if (distanceKm <= 0 || isNaN(distanceKm)) {
    return {
      fee: 0,
      status: 'needs_merchant_confirmation',
      distanceKm: 0,
    };
  }

  if (distanceKm > maxDeliveryRadiusKm) {
    return {
      fee: 0,
      status: 'needs_merchant_confirmation',
      distanceKm,
    };
  }

  const billableKm = Math.max(0, distanceKm - baseThresholdKm);
  const fee = Math.round(baseFee + billableKm * feePerKm);

  return {
    fee,
    status: 'known',
    distanceKm,
  };
}