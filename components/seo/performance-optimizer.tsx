"use client"

import { useEffect } from 'react'

export function PerformanceOptimizer() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) {
      return
    }

    const timeoutId = setTimeout(() => {
      const existingHints = document.querySelectorAll('link[rel="preconnect"]')
      const existingDomains = Array.from(existingHints).map(link => link.getAttribute('href'))
      
      const criticalDomains = [
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com'
      ]
      
      criticalDomains.forEach((domain) => {
        if (!existingDomains.includes(domain)) {
          const link = document.createElement('link')
          link.rel = 'preconnect'
          link.href = domain
          link.crossOrigin = 'anonymous'
          document.head.appendChild(link)
        }
      })
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [])

  return null
}

export function ArticleImageOptimizer({ src, alt, className = "" }: { 
  src: string
  alt: string
  className?: string 
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      style={{
        width: '100%',
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'cover'
      }}
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.src = '/images/culture-alberta-og.jpg'
        target.alt = 'Culture Alberta'
      }}
    />
  )
}
