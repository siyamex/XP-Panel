import { cn } from '@/lib/utils/cn'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-muted border-t-foreground animate-spin',
        sizeClasses[size],
        className,
      )}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}
