import { SkeletonPasswordPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function PasswordLoading() {
  return <SkeletonPasswordPage />
}

export default getTemplateOrDefault('app/dashboard/settings/password/loading.tsx', PasswordLoading)
