"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface LinkPrefetchProps {
  href: string
  children: React.ReactNode
  className?: string
  prefetch?: boolean
}

export function LinkPrefetch({ 
  href, 
  children, 
  className = '',
  prefetch = true 
}: LinkPrefetchProps) {
  const router = useRouter()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const prefetchedRef = useRef(false)

  useEffect(() => {
    if (!prefetch || !linkRef.current || prefetchedRef.current) return

    const link = linkRef.current

    const handleMouseEnter = () => {
      if (!prefetchedRef.current && href.startsWith('/')) {
        router.prefetch(href)
        prefetchedRef.current = true
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !prefetchedRef.current && href.startsWith('/')) {
            router.prefetch(href)
            prefetchedRef.current = true
          }
        })
      },
      { rootMargin: '50px' }
    )

    link.addEventListener('mouseenter', handleMouseEnter)
    observer.observe(link)

    return () => {
      link.removeEventListener('mouseenter', handleMouseEnter)
      observer.disconnect()
    }
  }, [href, router, prefetch])

  return (
    <a
      ref={linkRef}
      href={href}
      className={className}
    >
      {children}
    </a>
  )
}

