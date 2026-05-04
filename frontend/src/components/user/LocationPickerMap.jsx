// frontend/src/components/user/LocationPickerMap.jsx
//
// Map modal for picking a delivery location. Restaurant pins and cluster lines
// come from GET /api/search/map (real DB data).
//
// Props:
//   isOpen          - boolean
//   onClose         - () => void
//   onConfirm       - (location: { lat, lng }) => void
//   initialLocation - { lat, lng } | null

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { getSearchMap } from '../../services/searchService'
import { haversineKm, normalizeMapLocation } from '../../utils/geoClient'

// Must match backend MAP_CLUSTER_PALETTE order (searchController.js)
const CLUSTER_PALETTE = ['#059669', '#7c3aed', '#ea580c', '#0284c7', '#ca8a04']
const STANDALONE_COLOR = '#9ca3af'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const makeUserIcon = () => L.divIcon({
  className: '',
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
  html: `
    <div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;inset:0;
        border-radius:50%;
        background:rgba(249,115,22,0.25);
        animation:pulse 1.8s ease-out infinite;
      "></div>
      <div style="
        position:absolute;inset:6px;
        background:#f97316;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:13px;line-height:1;
      ">📍</div>
    </div>
    <style>
      @keyframes pulse {
        0%   { transform:scale(1);   opacity:.6 }
        100% { transform:scale(2.2); opacity:0  }
      }
    </style>
  `,
})

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')

const makeRestaurantIcon = (color, label) => {
  const safe = escapeHtml((label || '🍽️').slice(0, 2))
  return L.divIcon({
    className: '',
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
    html: `
    <div style="
      width:36px;height:36px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:13px;line-height:1;font-weight:700;color:white;
      font-family:system-ui,sans-serif;
    ">${safe}</div>
  `,
  })
}

const ClickHandler = ({ onSelect }) => {
  useMapEvents({ click: (e) => onSelect({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/**
 * Leaflet only reads MapContainer `center` on first mount. Preset "Jump to" buttons
 * update `selected`, but a bounds fit that always includes every restaurant was
 * re-running and zooming back out — so the pin moved but the view never followed.
 * Fit all pins once when data loads; after that, pan/zoom to the user's pin only.
 */
const MapViewSync = ({ selected, restaurantLatLngs, isModalOpen }) => {
  const map = useMap()
  const didInitialFit = useRef(false)

  useEffect(() => {
    if (!isModalOpen) didInitialFit.current = false
  }, [isModalOpen])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize()
    })
    return () => cancelAnimationFrame(id)
  }, [map, restaurantLatLngs])

  useEffect(() => {
    const lat = selected.lat
    const lng = selected.lng

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    if (restaurantLatLngs.length === 0) {
      map.setView([lat, lng], 13)
      return
    }

    if (!didInitialFit.current) {
      const positions = [[lat, lng], ...restaurantLatLngs]
      map.fitBounds(L.latLngBounds(positions), { padding: [44, 44], maxZoom: 14 })
      didInitialFit.current = true
      return
    }

    map.flyTo([lat, lng], 14, { duration: 0.35 })
  }, [map, selected.lat, selected.lng, restaurantLatLngs, isModalOpen])
  return null
}

const PRESETS = [
  { label: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { label: 'Gulshan',   lat: 23.7925, lng: 90.4078 },
  { label: 'Mirpur',    lat: 23.8223, lng: 90.3654 },
  { label: 'Uttara',    lat: 23.8759, lng: 90.3795 },
  { label: 'Motijheel', lat: 23.7330, lng: 90.4182 },
  { label: 'Mohakhali', lat: 23.7808, lng: 90.4015 },
]

const DEFAULT_LOCATION = { lat: 23.7808, lng: 90.4015 }

function coerceValidLocation(loc, fallback = DEFAULT_LOCATION) {
  return normalizeMapLocation(loc, fallback)
}

const LocationPickerMap = ({ isOpen, onClose, onConfirm, initialLocation }) => {
  const [selected, setSelected] = useState(() =>
    coerceValidLocation(initialLocation, DEFAULT_LOCATION)
  )
  const [mapPayload, setMapPayload] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState(null)

  const ilat = initialLocation?.lat
  const ilng = initialLocation?.lng
  const prevOpenRef = useRef(false)

  // When the modal opens, snap the pin + map center to the latest props (saved profile /
  // parent mapLocation). useLayoutEffect avoids one frame centered on stale defaults.
  useLayoutEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setSelected(coerceValidLocation({ lat: ilat, lng: ilng }, DEFAULT_LOCATION))
    }
    prevOpenRef.current = isOpen
  }, [isOpen, ilat, ilng])


  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setMapLoading(true)
    setMapError(null)
    getSearchMap()
      .then((data) => {
        if (!cancelled) setMapPayload(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setMapPayload(null)
          setMapError(err?.response?.data?.message || 'Could not load restaurants for map')
        }
      })
      .finally(() => {
        if (!cancelled) setMapLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen])

  const restaurants = useMemo(() => {
    const rows = mapPayload?.restaurants
    if (!Array.isArray(rows)) return []
    return rows.map((r) => {
      const lat = Number(r.lat)
      const lng = Number(r.lng)
      const dist =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? parseFloat(haversineKm(selected.lat, selected.lng, lat, lng).toFixed(2))
          : null
      return { ...r, lat, lng, distanceKm: dist }
    })
  }, [mapPayload, selected.lat, selected.lng])

  const clusterPolylines = mapPayload?.clusterPolylines ?? []

  const restaurantLatLngs = useMemo(() => {
    const rows = mapPayload?.restaurants
    if (!Array.isArray(rows)) return []
    return rows
      .map((r) => [Number(r.lat), Number(r.lng)])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
  }, [mapPayload])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">

        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              Pick your delivery location
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live restaurants from the map. Click to move your pin; distances update from it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-2 border-b border-gray-100 flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-400 shrink-0">Jump to:</span>
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => setSelected({ lat: p.lat, lng: p.lng })}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600
                         hover:bg-orange-50 hover:border-orange-400 hover:text-orange-700 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-80 sm:h-96 w-full relative">
          {mapError && (
            <div className="absolute top-2 left-2 right-2 z-[2000] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {mapError}
            </div>
          )}
          {mapLoading && (
            <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-white/60 text-sm text-gray-600">
              Loading map…
            </div>
          )}

          <MapContainer
            center={[selected.lat, selected.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapViewSync
              selected={selected}
              restaurantLatLngs={restaurantLatLngs}
              isModalOpen={isOpen}
            />
            <ClickHandler onSelect={setSelected} />

            <Marker position={[selected.lat, selected.lng]} icon={makeUserIcon()}>
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-gray-900">📍 Your location</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click anywhere to move this pin
                  </p>
                </div>
              </Popup>
            </Marker>

            {clusterPolylines.map((line) => (
              line.positions?.length >= 2 ? (
                <Polyline
                  key={line.key}
                  positions={line.positions}
                  pathOptions={{
                    color: line.color ?? '#6b7280',
                    weight: 2,
                    dashArray: '6 5',
                    opacity: 0.75,
                  }}
                />
              ) : null
            ))}

            {restaurants.map((r) => {
              if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return null
              const color =
                r.clusterIndex != null
                  ? CLUSTER_PALETTE[r.clusterIndex % CLUSTER_PALETTE.length]
                  : STANDALONE_COLOR
              const glyph = (r.name || '?').trim().charAt(0).toUpperCase() || '🍽️'

              return (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  icon={makeRestaurantIcon(color, glyph)}
                >
                  <Popup>
                    <div className="text-sm min-w-[160px]">
                      <p className="font-bold text-gray-900">{r.name}</p>
                      {r.clusterIndex != null ? (
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 mt-1"
                          style={{
                            background: `${color}22`,
                            color,
                            border: `1px solid ${color}44`,
                          }}
                        >
                          Part of delivery cluster
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full mb-1.5 mt-1">
                          Standard delivery
                        </span>
                      )}
                      {r.address ? (
                        <p className="text-xs text-gray-500 mt-1">{r.address}</p>
                      ) : null}
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
                        {r.distanceKm != null ? (
                          <span>📍 {r.distanceKm} km from pin</span>
                        ) : null}
                        {r.avgRating != null ? (
                          <span>⭐ {Number(r.avgRating).toFixed(1)}</span>
                        ) : null}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-3 py-2.5 pointer-events-none max-w-[200px]">
            <p className="text-xs font-bold text-gray-600 mb-1.5">Map legend</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-orange-400 inline-block shrink-0" />
                Your pin
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: CLUSTER_PALETTE[0] }} />
                Cluster (same color = same group)
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-gray-400 inline-block shrink-0" />
                Not in a cluster
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 font-mono">
            📍 {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(selected); onClose() }}
              className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all shadow-sm shadow-orange-200"
            >
              Confirm Location ✓
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default LocationPickerMap
