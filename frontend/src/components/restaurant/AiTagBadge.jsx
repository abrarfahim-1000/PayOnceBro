import { Badge } from '../ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

const formatTag = (tag) =>
  tag
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return []
  return tags
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

const AiTagBadge = ({ tags }) => {
  const normalized = normalizeTags(tags)
  if (normalized.length === 0) return null

  const visible = normalized.slice(0, 3)
  const overflow = normalized.slice(3)

  return (
    <TooltipProvider delayDuration={120}>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {visible.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] font-medium">
            {formatTag(tag)}
          </Badge>
        ))}

        {overflow.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help text-[10px] font-medium">
                +{overflow.length} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span>{overflow.map(formatTag).join(', ')}</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

export default AiTagBadge