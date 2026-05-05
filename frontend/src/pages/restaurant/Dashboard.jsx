import { useState, useEffect } from 'react'
import useRestaurantOrders from '../../hooks/useRestaurantOrders'
import OrderCard from '../../components/restaurant/OrderCard'
import LocationPickerMap from '../../components/user/LocationPickerMap'
import { Button } from '../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { getProfile, updateProfile } from '../../services/restaurantService'
import { toast } from 'sonner'

const TABS = [
  { key: 'pending',   label: 'New Orders' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'completed', label: 'Completed Today' },
]

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <span className="text-4xl mb-3">🍽️</span>
    <p className="text-sm">{message}</p>
  </div>
)

const EMPTY_PROFILE = {
  name: '',
  address: '',
  lat: '',
  lng: '',
  avg_prep_time: '',
  max_capacity_per_hour: '',
  is_active: true,
  cuisine: '',
  phone: '',
}

const toInputValue = (value) => (value ?? '')
const toNullableNumber = (value) => (value === '' ? null : Number(value))

const isProfileSetupComplete = (form) => {
  const hasName = !!form.name?.trim()
  const hasAddress = !!form.address?.trim()
  const hasCoords = form.lat !== '' && form.lng !== ''
  return hasName && hasAddress && hasCoords
}

const removeNil = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
)

// ─── Restaurant Info Tab ──────────────────────────────────────────────────────

const RestaurantInfo = () => {
  const [info, setInfo] = useState({ name: '', address: '', cuisine: '' })

  useEffect(() => {
    getProfile()
      .then((p) => setInfo({
        name: p.name || '',
        address: p.address || '',
        cuisine: p.cuisine || '',
      }))
      .catch(() => {})
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 px-5 py-3 flex items-center gap-3">
      <span className="text-sm font-semibold text-gray-800">
        {info.name || 'Restaurant'}
      </span>
      {info.address && (
        <span className="text-xs text-gray-400">{info.address}</span>
      )}
      {info.cuisine && (
        <span className="text-xs rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">
          {info.cuisine}
        </span>
      )}
    </div>
  )
}

const RestaurantDetailsPanel = () => {
  const [form, setForm] = useState(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)

  useEffect(() => {
    if (!error) return
    toast.error(error, { id: `error-${error}` })
  }, [error])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const profile = await getProfile()
        const nextForm = {
          name: profile.name ?? '',
          address: profile.address ?? '',
          lat: toInputValue(profile.lat),
          lng: toInputValue(profile.lng),
          avg_prep_time: toInputValue(profile.avg_prep_time),
          max_capacity_per_hour: toInputValue(profile.max_capacity_per_hour),
          is_active: profile.is_active ?? true,
          cuisine: profile.cuisine ?? '',
          phone: profile.phone ?? '',
        }
        setForm(nextForm)
        setShowSetupModal(!isProfileSetupComplete(nextForm))
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load restaurant details.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const updateField = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleMapConfirm = ({ lat, lng }) => {
    setForm((prev) => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = removeNil({
        name: form.name.trim(),
        address: form.address.trim() || null,
        cuisine: form.cuisine.trim() || null,
        phone: form.phone.trim() || null,
        lat: toNullableNumber(form.lat),
        lng: toNullableNumber(form.lng),
        avg_prep_time: toNullableNumber(form.avg_prep_time),
        max_capacity_per_hour: toNullableNumber(form.max_capacity_per_hour),
        is_active: !!form.is_active,
      })

      const profile = await updateProfile(payload)
      const nextForm = {
        name: profile.name ?? '',
        address: profile.address ?? '',
        lat: toInputValue(profile.lat),
        lng: toInputValue(profile.lng),
        avg_prep_time: toInputValue(profile.avg_prep_time),
        max_capacity_per_hour: toInputValue(profile.max_capacity_per_hour),
        is_active: profile.is_active ?? true,
        cuisine: profile.cuisine ?? '',
        phone: profile.phone ?? '',
      }
      setForm(nextForm)
      setShowSetupModal(!isProfileSetupComplete(nextForm))
      toast.success('Restaurant details updated.')
    } catch (err) {
      if (!err?.response) {
        setError('Cannot reach backend API. Start backend on http://localhost:5000 and try again.')
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to save restaurant details.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 p-5 animate-pulse h-48" />
    )
  }

  return (
    <>
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-gray-200 shadow-xl p-5">
            <h3 className="text-lg font-bold text-gray-900">Set up your restaurant</h3>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Complete these details to activate your restaurant dashboard for first-time login.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Restaurant name</label>
                  <input
                    value={form.name}
                    onChange={updateField('name')}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cuisine</label>
                  <input
                    value={form.cuisine}
                    onChange={updateField('cuisine')}
                    placeholder="e.g. Fast Food"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                  <div className="flex gap-2">
                    <input
                      value={form.address}
                      onChange={updateField('address')}
                      required
                      placeholder="Restaurant address"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="px-3 py-2 rounded-md border border-orange-300 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors whitespace-nowrap"
                    >
                      Pin location
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={form.lat}
                    onChange={updateField('lat')}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={form.lng}
                    onChange={updateField('lng')}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={updateField('phone')}
                    placeholder="e.g. +8801XXXXXXXXX"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Complete setup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LocationPickerMap
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={handleMapConfirm}
        initialLocation={
          form.lat !== '' && form.lng !== ''
            ? { lat: Number(form.lat), lng: Number(form.lng) }
            : null
        }
      />

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsDetailsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsDetailsOpen((prev) => !prev)
            }
          }}
          className="flex items-start justify-between gap-3 p-5 cursor-pointer"
        >
          <div>
            <h2 className="text-lg font-bold text-gray-800">Restaurant Details</h2>
            <p className="text-xs text-gray-500 mt-1">
              Click to {isDetailsOpen ? 'collapse' : 'expand'} and update your restaurant information.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label
              className="inline-flex items-center gap-2 text-sm text-gray-600"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={updateField('is_active')}
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              Active
            </label>
            <span className="text-xs font-medium text-orange-700">
              {isDetailsOpen ? 'Hide details' : 'Show details'}
            </span>
          </div>
        </div>

        {isDetailsOpen && (
          <div className="border-t border-gray-100 p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Restaurant name</label>
            <input
              value={form.name}
              onChange={updateField('name')}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cuisine</label>
            <input
              value={form.cuisine}
              onChange={updateField('cuisine')}
              placeholder="e.g. Fast Food"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={updateField('phone')}
              placeholder="e.g. +8801XXXXXXXXX"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <div className="flex gap-2">
              <input
                value={form.address}
                onChange={updateField('address')}
                placeholder="Restaurant address"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="px-3 py-2 rounded-md border border-orange-300 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors whitespace-nowrap"
              >
                Pin drop location
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={form.lat}
              onChange={updateField('lat')}
              placeholder="23.780800"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={form.lng}
              onChange={updateField('lng')}
              placeholder="90.401500"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Average prep time (minutes)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.avg_prep_time}
              onChange={updateField('avg_prep_time')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Maximum capacity per hour</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.max_capacity_per_hour}
              onChange={updateField('max_capacity_per_hour')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save restaurant details'}
              </button>
            </div>
          </div>
        )}
      </form>
    </>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('pending')
  const { data: orders, loading, refresh } = useRestaurantOrders()

  const list = orders?.[activeTab] ?? []
  const activeTabConfig = TABS.find((tab) => tab.key === activeTab) ?? TABS[0]
  const activeCount = orders?.[activeTabConfig.key]?.length ?? 0

  return (
    <div>
      {/* Restaurant info tab */}
      <RestaurantInfo />

      {/* Restaurant details editor */}
      <RestaurantDetailsPanel />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Restaurant Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your incoming orders in real time</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Orders</h2>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Order status selector */}
      <div className="mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-56 justify-between">
              <span>{activeTabConfig.label}</span>
              {activeCount > 0 && (
                <span
                  className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
                    activeTabConfig.key === 'pending'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {activeCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TABS.map(({ key, label }) => {
              const count = orders?.[key]?.length ?? 0
              return (
                <DropdownMenuItem key={key} onClick={() => setActiveTab(key)}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{label}</span>
                    {count > 0 && (
                      <span
                        className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-bold ${
                          key === 'pending'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Order grid */}
      {!loading && list.length === 0 ? (
        <EmptyState
          message={
            activeTab === 'pending'
              ? 'No new orders right now.'
              : 'Nothing here yet.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChange={refresh} />
          ))}
        </div>
      )}

      {/* Skeleton cards while loading */}
      {loading && !orders && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-gray-200 p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
