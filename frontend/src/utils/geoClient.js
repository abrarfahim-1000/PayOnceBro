/**
 * Haversine distance (km) — mirrors backend/utils/geoUtils.js for browser use.
 */
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  // Sanity check for Null Island (0,0) — uninitialized coordinates
  if ((lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) {
    return 0
  }

  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  // Cap at 100km for UI sanity
  return Math.min(dist, 100)
}

/** Valid WGS84 point for map use, or null (missing / placeholder / null island). */
export function parseLatLng(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a < -90 || a > 90 || b < -180 || b > 180) return null
  if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return null
  return { lat: a, lng: b }
}

const MAP_FALLBACK_DHAKA = Object.freeze({ lat: 23.7808, lng: 90.4015 })

/** Fallback when coordinates are unusable — defaults to central Dhaka. */
export function normalizeMapLocation(loc, fallback = MAP_FALLBACK_DHAKA) {
  const parsed = parseLatLng(loc?.lat, loc?.lng)
  if (parsed) return parsed
  const fb = parseLatLng(fallback?.lat, fallback?.lng)
  return fb ? { lat: fb.lat, lng: fb.lng } : { lat: MAP_FALLBACK_DHAKA.lat, lng: MAP_FALLBACK_DHAKA.lng }
}

