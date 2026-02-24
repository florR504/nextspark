import { SkeletonSecurityPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function SecurityLoading() {
  return <SkeletonSecurityPage />
}

export default getTemplateOrDefault('app/dashboard/settings/security/loading.tsx', SecurityLoading)
