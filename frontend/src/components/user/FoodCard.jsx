import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

const TAG_EMOJI = {
  vegan: '🥬',
  spicy: '🌶️',
  vegetarian: '🥕',
  healthy: '🥗',
  popular: '⭐',
}

const categoryGradient = (cat) => {
  const map = {
    'Pizza': 'linear-gradient(to right, #f87171, #fca5a5)',
    'Burger': 'linear-gradient(to right, #fbbf24, #fcd34d)',
  }
  return map[cat] || 'linear-gradient(to right, #cbd5e1, #e2e8f0)'
}

const FoodCard = ({ item, onAddToCart }) => {
  const { menuItem, restaurant, distanceKm, isClusterEligible } = item

  const formatPrice = (price) => `৳${Number(price).toFixed(0)}`
  const formatDistance = (km) =>
    km === null ? null : km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`

  return (
    <div className="group bg-card rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
      {/* Colourful top accent */}
      <div
        className="h-1.5 w-full"
        style={{ background: categoryGradient(menuItem.category) }}
      />

      <div className="p-4 flex flex-col gap-3 flex-1 h-full isolate">
        {/* Food name + cluster badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-card-foreground text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {menuItem.name}
          </h3>
          {isClusterEligible && (
            <Badge variant="secondary" className="shrink-0 font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
              🔗 Save more!
            </Badge>
          )}
        </div>

        {/* Description */}
        {menuItem.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {menuItem.description}
          </p>
        )}

        {/* AI Tags */}
        {menuItem.aiTags && menuItem.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {menuItem.aiTags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                {TAG_EMOJI[tag.toLowerCase()] ?? '🏷️'} {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex-1" />
        <Separator className="my-1" />

        {/* Restaurant info / Distance */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <Link 
               to={`/restaurants/${restaurant.id}`}
               className="flex items-center gap-1.5 truncate hover:text-orange-600 transition-colors"
            >
               <span className="text-sm">🍽️</span>
               <span className="truncate">{restaurant.name}</span>
            </Link>
          </div>
          
          {distanceKm !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                📍 {formatDistance(distanceKm)} away
              </span>
              {restaurant.avgPrepTime && (
                <span className="flex items-center gap-1">
                  ⏱️ ~{restaurant.avgPrepTime}m
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-3">
          <span className="text-lg font-black text-foreground tracking-tight">
            {formatPrice(menuItem.price)}
          </span>
          <Button 
            size="sm" 
            onClick={() => onAddToCart(item)}
            className="rounded-xl px-4 font-semibold shadow-sm hover:scale-105 transition-transform"
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FoodCard

