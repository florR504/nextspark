import { SkeletonProfileForm } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function ProfileLoading() {
  return <SkeletonProfileForm />
}

export default getTemplateOrDefault('app/dashboard/settings/profile/loading.tsx', ProfileLoading)
