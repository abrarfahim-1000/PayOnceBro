/**
 * Haversine distance formula — calculates the straight-line distance
 * between two GPS coordinates on the surface of the Earth.
 *
 * Think of the Earth as a sphere. Two restaurants are dots on that sphere.
 * This formula tells us exactly how many kilometres apart those dots are.
 *
 * @param {number} lat1 - Latitude of point 1 (e.g. restaurant)
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2 (e.g. user)
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometres
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  // Sanity check: (0,0) is likely a default/uninitialized value in our context (Bangladesh).
  // If either point is Null Island, we treat the distance as 0 to avoid 10,000km+ results.
  if ((lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) {
    return 0
  }

  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  // Safety cap: No delivery in this app should realistically exceed 100km.
  // This prevents 200,000 BDT fees or 40,000 minute ETAs from appearing.
  return Math.min(dist, 100)
}
