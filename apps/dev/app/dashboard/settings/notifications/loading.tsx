import { SkeletonNotificationsPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function NotificationsLoading() {
  return <SkeletonNotificationsPage />
}

export default getTemplateOrDefault('app/dashboard/settings/notifications/loading.tsx', NotificationsLoading)
