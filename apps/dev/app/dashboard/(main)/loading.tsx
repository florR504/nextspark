import { SkeletonDashboardHome } from '@nextsparkjs/core/components/ui/skeleton-dashboard'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function DashboardLoading() {
  return <SkeletonDashboardHome />
}

export default getTemplateOrDefault('app/dashboard/(main)/loading.tsx', DashboardLoading)
