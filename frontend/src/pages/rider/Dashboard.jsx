import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusButtons from '../../components/rider/StatusButtons.jsx'
import DemandNotification from '../../components/rider/DemandNotification.jsx'
import useRiderNotifications from '../../hooks/useRiderNotifications.js'
import { UrlState } from '../../context/AuthContext.jsx'
import { getProfile, getAssignments, getEarnings } from '../../services/riderService.js'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = UrlState()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [riderProfile, setRiderProfile] = useState(null)
  const [earnings, setEarnings] = useState({ todayEarnings: 0, todayDeliveries: 0 })
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set())
  const { notifications, markAsRead } = useRiderNotifications(user?.id)

  useEffect(() => {
    if (!error) return
    toast.error(error, { id: `error-${error}` })
  }, [error])

  // Fetch rider profile and assignments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profile, assignmentList, earningsSummary] = await Promise.all([
          getProfile(),
          getAssignments(),
          getEarnings(),
        ])

        setRiderProfile(profile)
        setAssignments(assignmentList)
        setEarnings({
          todayEarnings: earningsSummary?.todayEarnings ?? 0,
          todayDeliveries: earningsSummary?.todayDeliveries ?? 0,
        })
        setError(null)
      } catch (err) {
        console.error('Failed to fetch rider profile:', err)
        setError(err.response?.data?.message || 'Failed to load rider dashboard. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleStatusUpdate = (updatedOrder) => {
    if (!updatedOrder?.id) return
    setAssignments(prev =>
      prev.map(a => (a.id === updatedOrder.id ? updatedOrder : a))
    )
  }


  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-foreground">Rider Dashboard</h1>

      {/* High-Demand Zone Notifications */}
      {notifications && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications
            .filter(
              notif =>
                notif.type === 'high_demand_zone' &&
                !notif.is_read &&
                !dismissedNotifications.has(notif.id)
            )
            .map(notif => (
              <DemandNotification
                key={notif.id}
                notification={notif}
                onDismiss={(id) => {
                  setDismissedNotifications(prev => new Set([...prev, id]))
                }}
                onMarkAsRead={markAsRead}
              />
            ))}
        </div>
      )}

      {/* Rider Profile Summary */}
      {riderProfile ? (
        <Card>
          <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">
                {riderProfile.avg_rating?.toFixed(1) || '0.0'} ⭐
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Deliveries</p>
              <p className="text-2xl font-bold">
                {riderProfile.total_deliveries || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={riderProfile.is_available ? 'default' : 'secondary'}>
                {riderProfile.is_available ? 'Available' : 'On Delivery'}
              </Badge>
            </div>
          </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-sm text-muted-foreground">
          Loading your profile...
          </CardContent>
        </Card>
      )}

      {/* Active Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
        </CardHeader>
        <CardContent>
        
        {assignments.length === 0 ? (
          <p className="text-muted-foreground italic">
            No active assignments. You'll receive new deliveries when they're available.
          </p>
        ) : (
          <div className="grid gap-4">
            {assignments.map(order => (
              <div
                key={order.id}
                className="p-4 border border-border rounded-md bg-muted/20"
              >
                <div className="mb-4 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Order ID: <span className="font-semibold text-foreground">{order.id.slice(0, 8)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="font-semibold text-primary">
                      {order.status}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stops: <span className="font-semibold text-foreground">{order.restaurants?.length || 0}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Items: <span className="font-semibold text-foreground">{order.itemCount || 0}</span>
                  </p>
                </div>

                {/* View Route and Status Update Buttons */}
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    onClick={() => {
                      if (order.cluster_id) {
                        navigate(`/rider/route?clusterId=${order.cluster_id}`)
                      } else {
                        navigate(`/rider/route?orderId=${order.id}`)
                      }
                    }}
                    className="flex-1"
                  >
                    🗺️ View Route
                  </Button>
                </div>

                {/* Status Update Buttons */}
                <StatusButtons
                  orderId={order.id}
                  currentStatus={order.status}
                  onStatusUpdate={handleStatusUpdate}
                />
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {/* Today's Earnings Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Performance</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Earnings</p>
            <p className="text-xl font-bold">৳{Number(earnings.todayEarnings || 0).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deliveries</p>
            <p className="text-xl font-bold">{earnings.todayDeliveries || 0}</p>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard