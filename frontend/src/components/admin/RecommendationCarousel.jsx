import { Button } from '../ui/button'
import FoodCard from '../user/FoodCard'

const RecommendationCarousel = ({ title, subtitle, items, onAddToCart, onSeeAll }) => {
  const list = Array.isArray(items) ? items : []

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-card-foreground">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {onSeeAll ? (
          <Button variant="outline" size="sm" onClick={onSeeAll}>
            See all
          </Button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          No recommendations yet.
        </div>
      ) : (
        <div className="mt-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-3">
            {list.map((row) => (
              <div key={row.menuItem?.id} className="min-w-65 max-w-65">
                <FoodCard item={row} onAddToCart={onAddToCart} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default RecommendationCarousel
