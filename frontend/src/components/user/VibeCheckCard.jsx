const VibeCheckCard = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
        <div className="h-3 w-24 bg-gray-100 rounded" />
        <div className="h-4 w-full bg-gray-100 rounded mt-3" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500">Vibe check</p>
        <p className="text-sm text-gray-500 mt-2">
          Not enough reviews yet. Check back after a few more orders.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white shadow-sm p-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
          Vibe check
        </p>
      </div>
      <p className="text-sm text-gray-700 mt-2">{summary}</p>
    </div>
  )
}

export default VibeCheckCard
