import { SkeletonPlansPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function PlansLoading() {
  return <SkeletonPlansPage />
}

export default getTemplateOrDefault('app/dashboard/settings/plans/loading.tsx', PlansLoading)
