import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicRestaurant } from '../../services/publicRestaurantService'
import { useCart } from '../../context/CartContext'
import { toast } from 'sonner'

const RestaurantCard = ({ restaurant, clusterColor, distanceKm }) => {
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(null)
  const [loadingMenu, setLoadingMenu] = useState(false)
  const { items, addItem, updateQuantity } = useCart()

  // Lazy-load the menu when the user expands for the first time.
  useEffect(() => {
    if (!expanded || menu !== null || loadingMenu) return
    setLoadingMenu(true)
    getPublicRestaurant(restaurant.id)
      .then((data) => setMenu(Array.isArray(data.menu) ? data.menu : []))
      .catch(() => setMenu([]))
      .finally(() => setLoadingMenu(false))
  }, [expanded, menu, loadingMenu, restaurant.id])

  const qtyOf = (menuItemId) =>
    items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0

  const handleAdd = (item) => {
    addItem(
      { id: item.id, name: item.name, price: Number(item.price) },
      { id: restaurant.id, name: restaurant.name }
    )
    toast.success(`${item.name} added to cart`)
  }

  return (
    <div
      className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all"
      style={{ borderColor: clusterColor || '#e5e7eb' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-black text-lg shrink-0"
          style={{
            background: clusterColor
              ? `linear-gradient(135deg, ${clusterColor}, ${clusterColor}dd)`
              : 'linear-gradient(135deg, #fb923c, #f43f5e)',
          }}
        >
          {restaurant.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{restaurant.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {restaurant.address || '—'}
          </p>
          <div className="flex gap-2 mt-0.5 text-[11px] text-gray-500">
            {typeof distanceKm === 'number' && (
              <span>📍 {distanceKm.toFixed(2)} km</span>
            )}
            {restaurant.avg_prep_time && <span>⏱ ~{restaurant.avg_prep_time} min</span>}
            {restaurant.avg_rating > 0 && <span>⭐ {Number(restaurant.avg_rating).toFixed(1)}</span>}
          </div>
        </div>
        <div className="shrink-0">
          <Link
            to={`/restaurants/${restaurant.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 mr-3"
          >
            View
          </Link>
          <span className={`text-gray-400 transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {loadingMenu && (
            <p className="text-xs text-gray-400 animate-pulse py-3">Loading menu…</p>
          )}

          {!loadingMenu && menu && menu.length === 0 && (
            <p className="text-xs text-gray-400 py-3">No items available right now.</p>
          )}

          {!loadingMenu && menu && menu.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {menu.map((item) => {
                const qty = qtyOf(item.id)
                return (
                  <li key={item.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-sm font-bold text-orange-600 mt-0.5">
                        ৳{Number(item.price).toFixed(0)}
                      </p>
                    </div>
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(item)}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 active:scale-95 transition"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, qty - 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold w-5 text-center">{qty}</span>
                        <button
                          onClick={() => updateQuantity(item.id, qty + 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default RestaurantCard
