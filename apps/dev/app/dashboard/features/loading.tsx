import { SkeletonFeaturePlaceholder } from '@nextsparkjs/core/components/ui/skeleton-features'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function FeaturesLoading() {
  return <SkeletonFeaturePlaceholder />
}

export default getTemplateOrDefault('app/dashboard/features/loading.tsx', FeaturesLoading)
