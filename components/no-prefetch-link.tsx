import Link from 'next/link'
import { ComponentProps } from 'react'

interface NoPrefetchLinkProps extends ComponentProps<typeof Link> {
  children: React.ReactNode
}

export function NoPrefetchLink({ children, ...props }: NoPrefetchLinkProps) {
  return (
    <Link {...props} prefetch={false}>
      {children}
    </Link>
  )
}

