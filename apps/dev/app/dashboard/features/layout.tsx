import { type ReactNode } from 'react'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

interface FeaturesLayoutProps {
  children: ReactNode
}

function FeaturesLayout({ children }: FeaturesLayoutProps) {
  return (
    <div className="container py-8" data-cy="features-layout">
      {children}
    </div>
  )
}

export default getTemplateOrDefault('app/dashboard/features/layout.tsx', FeaturesLayout)
