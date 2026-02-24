import { SkeletonApiKeysPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function ApiKeysLoading() {
  return <SkeletonApiKeysPage />
}

export default getTemplateOrDefault('app/dashboard/settings/api-keys/loading.tsx', ApiKeysLoading)
