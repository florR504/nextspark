import { SkeletonInvoicesPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

function InvoicesLoading() {
  return <SkeletonInvoicesPage />
}

export default getTemplateOrDefault('app/dashboard/settings/invoices/loading.tsx', InvoicesLoading)
