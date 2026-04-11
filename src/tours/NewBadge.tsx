import { cn } from '@/lib/utils'

/**
 * Pulsing "NEW" pill badge for marking new features inline.
 * Pair with a tour ID to auto-hide once the tour is seen.
 */
export function NewBadge({
  className,
  children = 'NEW',
}: {
  className?: string
  children?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5',
        'text-[10px] font-bold uppercase leading-none tracking-wider',
        'bg-gold/15 text-gold',
        'animate-pulse',
        className,
      )}
    >
      {children}
    </span>
  )
}
