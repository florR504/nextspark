import { SkeletonBillingPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function BillingLoading() {
  return <SkeletonBillingPage />
}

export default getTemplateOrDefault('app/dashboard/settings/billing/loading.tsx', BillingLoading)
