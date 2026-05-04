import React from 'react'
import PrepTimer from './PrepTimer'
import OrderActionButtons from './OrderActionButtons'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'

const STATUS_BADGE = {
  pending:   'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  accepted:  'bg-blue-100 text-blue-800 hover:bg-blue-200',
  preparing: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  pickup:    'bg-purple-100 text-purple-800 hover:bg-purple-200',
  delivered: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  cancelled: 'bg-red-100 text-red-800 hover:bg-red-200',
}

const fmt = (n) => `৳${Number(n).toFixed(0)}`

const OrderCard = ({ order, onStatusChange }) => {
  const isAccepted = order.status === 'accepted'

  return (
    <Card className="shadow-sm overflow-hidden border-border transition-all hover:shadow-md">
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground font-mono">
              #{order.id.slice(-8).toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Cluster badge */}
            {order.isClusteredOrder && (
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-2 py-0.5 whitespace-nowrap">
                🔗 Cluster ×{order.cluster?.restaurantCount ?? '?'}
              </Badge>
            )}
            <Badge variant="outline" className={`capitalize whitespace-nowrap ${STATUS_BADGE[order.status] ?? 'bg-muted text-muted-foreground'}`}>
              {order.status}
            </Badge>
          </div>
        </div>

        <Separator className="my-1 opacity-50" />

        {/* Items list */}
        <ul className="space-y-1.5">
          {order.myItems.map((item) => (
            <li key={item.id} className="flex justify-between text-sm text-foreground">
              <span>
                <span className="font-semibold text-primary">{item.quantity}×</span>{' '}
                {item.menu_items?.name ?? 'Item'}
              </span>
              <span className="text-muted-foreground font-medium">{fmt(item.price_at_order * item.quantity)}</span>
            </li>
          ))}
        </ul>

        {/* Footer: total + prep timer */}
        <Separator className="my-1 border-dashed" />
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-foreground">
            {fmt(order.total_price)}
          </span>

          {/* Prep timer only shows once order is accepted */}
          {isAccepted && (
            <PrepTimer prepTimeMinutes={order.restaurantPrepTime} />
          )}
        </div>

        {/* Cluster details */}
        {order.isClusteredOrder && order.cluster && (
          <div className="text-xs text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 mt-1 leading-relaxed">
            Grouped delivery across <strong className="font-semibold text-indigo-900">{order.cluster.restaurantCount}</strong> restaurant
            {order.cluster.restaurantCount !== 1 ? 's' : ''} — lower delivery fee for customer.
          </div>
        )}

        {/* Rider details (once assigned) */}
        {order.rider && (
          <div className="text-xs text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-lg p-2.5 mt-1 leading-relaxed">
            Assigned rider: <strong className="font-semibold text-emerald-900">{order.rider.fullName}</strong>
            <span className="ml-2 text-emerald-800">⭐ {Number(order.rider.avgRating || 0).toFixed(1)}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="pt-2">
          <OrderActionButtons order={order} onStatusChange={onStatusChange} />
        </div>
      </CardContent>
    </Card>
  )
}

export default OrderCard
