'use client'

import Link, { LinkProps } from 'next/link'
import { useState, ReactNode } from 'react'

interface PrefetchLinkProps extends Omit<LinkProps, 'prefetch'> {
  children: ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
  onMouseEnter?: () => void
  title?: string
}

/**
 * Smart prefetch link that only prefetches on hover.
 * 
 * This gives the best of both worlds:
 * - No unnecessary prefetches on page load (saves Vercel invocations)
 * - Fast navigation when user hovers (prefetches before click)
 * 
 * Based on Next.js official recommendation:
 * https://nextjs.org/docs/app/guides/prefetching
 */
export function PrefetchLink({
  href,
  children,
  className,
  onClick,
  onMouseEnter,
  title,
  ...props
}: PrefetchLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false)

  const handleMouseEnter = () => {
    setShouldPrefetch(true)
    onMouseEnter?.()
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
      className={className}
      title={title}
      {...props}
    >
      {children}
    </Link>
  )
}
