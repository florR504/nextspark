import { SkeletonTeamsPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function TeamsLoading() {
  return <SkeletonTeamsPage />
}

export default getTemplateOrDefault('app/dashboard/settings/teams/loading.tsx', TeamsLoading)
