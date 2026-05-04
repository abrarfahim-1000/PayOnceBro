import React, { useEffect, useMemo, useState } from 'react'
import { getAnalytics, getDemandZones } from '../../services/adminService'
import StatCard from '../../components/admin/StatCard'
import RevenueChart from '../../components/admin/RevenueChart'
import Error from '../../components/common/Error'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'

const formatCount = (value) => new Intl.NumberFormat().format(Number(value || 0))

const formatMoney = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatRating = (value) => Number(value || 0).toFixed(1)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const reverseGeocode = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('Failed to reverse geocode')
  const data = await res.json()
  const name = data?.display_name || ''
  if (!name) return 'Unknown location'
  return name.split(',').slice(0, 3).map((s) => s.trim()).join(', ')
}


const Analytics = () => {
  const [data, setData] = useState(null)
  const [demandZones, setDemandZones] = useState([])
  const [demandUpdatedAt, setDemandUpdatedAt] = useState('')
  const [zoneNames, setZoneNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [analytics, demand] = await Promise.all([
          getAnalytics(),
          getDemandZones().catch(() => ({ zones: [], timestamp: '' })),
        ])
        if (mounted) {
          setData(analytics)
          setDemandZones(demand?.zones || [])
          setDemandUpdatedAt(demand?.timestamp || '')
        }
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || 'Failed to load analytics')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadNames = async () => {
      const nextNames = {}
      for (const zone of demandZones) {
        const key = `${zone.lat},${zone.lng}`
        if (zoneNames[key]) continue
        try {
          const name = await reverseGeocode(zone.lat, zone.lng)
          nextNames[key] = name
        } catch {
          nextNames[key] = 'Unknown location'
        }
        await sleep(300)
      }

      if (active && Object.keys(nextNames).length > 0) {
        setZoneNames((prev) => ({ ...prev, ...nextNames }))
      }
    }

    if (demandZones.length > 0) {
      loadNames()
    }

    return () => {
      active = false
    }
  }, [demandZones, zoneNames])

  const weeklyRevenue = useMemo(() => {
    const rows = data?.weeklyRevenue || []
    return rows.map((row) => ({
      ...row,
      dayLabel: row.day?.slice(5) || 'N/A',
      revenue: Number(row.revenue || 0),
    }))
  }, [data])


  if (loading) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </section>
    )
  }

  if (error) {
    return (
      <>
        <Error message={error} />
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Analytics unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Analytics</h1>
        <p className="text-sm text-muted-foreground">Real-time platform performance overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Orders" value={formatCount(data?.totalOrders)} />
        <StatCard
          label="Clustered Orders"
          value={formatCount(data?.clusteredOrders)}
          helper={`${Number(data?.clusterRate || 0).toFixed(2)}% of total orders`}
        />
        <StatCard
          label="Average Delivery Time"
          value={`${Number(data?.avgDeliveryTime || 0).toFixed(1)} mins`}
        />
        <StatCard
          label="Rider Efficiency"
          value={`${Number(data?.riderEfficiency || 0).toFixed(2)} deliveries/rider`}
          helper={`${formatCount(data?.deliveredOrdersPerRiderWindow)} delivered across ${formatCount(data?.riderCount)} riders (${Number(data?.riderEfficiencyWindowDays || 7)}d)`}
        />
        <StatCard label="Daily Sales" value={formatMoney(data?.dailySales)} />
        <StatCard
          label="Most Ordered Item"
          value={data?.mostOrderedItem?.name || 'N/A'}
          helper={data?.mostOrderedItem ? `${formatCount(data.mostOrderedItem.count)} orders` : 'No orders yet'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Low Rated Riders (Below 3.0)</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.lowRatedRiders || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No riders are currently below 3.0 rating.</p>
          ) : (
            <div className="space-y-2">
              {(data?.lowRatedRiders || []).map((rider) => (
                <div
                  key={rider.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{rider.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Rider ID: {String(rider.userId || '').slice(0, 8) || 'N/A'} | Deliveries: {formatCount(rider.totalDeliveries)} | Status: {rider.isAvailable ? 'Available' : 'On Delivery'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{formatRating(rider.avgRating)} / 5</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demand Zones</CardTitle>
        </CardHeader>
        <CardContent>
          {demandZones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No demand zones detected yet.{demandUpdatedAt ? ` Last checked: ${new Date(demandUpdatedAt).toLocaleTimeString()}` : ''}
            </p>
          ) : (
            <div className="space-y-2">
              {demandZones.map((zone, idx) => (
                <div
                  key={`${zone.lat}-${zone.lng}-${idx}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{zone.level.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      Lat: {Number(zone.lat).toFixed(2)} | Lng: {Number(zone.lng).toFixed(2)} | Orders: {formatCount(zone.orderCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Location: {zoneNames[`${zone.lat},${zone.lng}`] || 'Resolving...'}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${zone.level === 'HIGH_DEMAND' ? 'text-red-600' : 'text-slate-600'}`}>
                    {zone.level === 'HIGH_DEMAND' ? 'High' : 'Normal'}
                  </span>
                </div>
              ))}
              {demandUpdatedAt && (
                <p className="text-xs text-muted-foreground">
                  Updated at: {new Date(demandUpdatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RevenueChart data={weeklyRevenue} />
    </section>
  )
}

export default Analytics
