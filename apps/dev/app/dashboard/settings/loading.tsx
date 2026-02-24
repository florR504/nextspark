import { SkeletonSettingsOverview } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function SettingsLoading() {
  return <SkeletonSettingsOverview />
}

export default getTemplateOrDefault('app/dashboard/settings/loading.tsx', SettingsLoading)
