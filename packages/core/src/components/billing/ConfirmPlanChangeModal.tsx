'use client'

import { useMemo } from 'react'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ConfirmPlanChangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlanSlug: string
  targetPlanSlug: string
  onConfirm: () => void
  loading?: boolean
}

/**
 * ConfirmPlanChangeModal - Confirmation dialog for plan upgrades/downgrades
 *
 * Detects whether the change is an upgrade or downgrade based on plan price,
 * and shows an appropriate message to the user before confirming.
 *
 * @example
 * ```tsx
 * <ConfirmPlanChangeModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   currentPlanSlug="starter"
 *   targetPlanSlug="pro"
 *   onConfirm={() => handlePlanChange('pro')}
 *   loading={isChanging}
 * />
 * ```
 */
export function ConfirmPlanChangeModal({
  open,
  onOpenChange,
  currentPlanSlug,
  targetPlanSlug,
  onConfirm,
  loading = false
}: ConfirmPlanChangeModalProps) {
  const t = useTranslations('billing')

  const { currentPlan, targetPlan, isUpgrade, isDowngradeToFree } = useMemo(() => {
    const current = BILLING_REGISTRY.plans.find(p => p.slug === currentPlanSlug)
    const target = BILLING_REGISTRY.plans.find(p => p.slug === targetPlanSlug)

    const currentPrice = current?.price?.monthly ?? 0
    const targetPrice = target?.price?.monthly ?? 0

    return {
      currentPlan: current,
      targetPlan: target,
      isUpgrade: targetPrice > currentPrice,
      isDowngradeToFree: target?.type === 'free'
    }
  }, [currentPlanSlug, targetPlanSlug])

  const currentPriceDisplay = currentPlan?.price?.monthly
    ? `$${(currentPlan.price.monthly / 100).toFixed(0)}`
    : t('plans.free.name')

  const targetPriceDisplay = targetPlan?.price?.monthly
    ? `$${(targetPlan.price.monthly / 100).toFixed(0)}`
    : t('plans.free.name')

  const description = isDowngradeToFree
    ? t('changePlan.downgradeToFreeDescription')
    : isUpgrade
      ? t('changePlan.upgradeDescription')
      : t('changePlan.downgradeDescription')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-cy="confirm-plan-change-modal">
        <DialogHeader>
          <DialogTitle data-cy="confirm-plan-change-title">
            {t('changePlan.title')}
          </DialogTitle>
          <DialogDescription data-cy="confirm-plan-change-description">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex items-center justify-center gap-3 py-4 px-2 rounded-lg bg-muted/50"
          data-cy="confirm-plan-change-plans"
        >
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground">{t('changePlan.from')}</span>
            <Badge variant="outline" data-cy="confirm-plan-change-current">
              {t(`plans.${currentPlanSlug}.name`)}
            </Badge>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {currentPriceDisplay}{currentPlan?.price?.monthly ? t('perMonth') : ''}
            </span>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />

          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground">{t('changePlan.to')}</span>
            <Badge variant="default" data-cy="confirm-plan-change-target">
              {t(`plans.${targetPlanSlug}.name`)}
            </Badge>
            <span className="text-sm font-bold tabular-nums">
              {targetPriceDisplay}{targetPlan?.price?.monthly ? t('perMonth') : ''}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-cy="confirm-plan-change-cancel"
          >
            {t('changePlan.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            data-cy="confirm-plan-change-confirm"
          >
            {loading ? t('changePlan.confirming') : t('changePlan.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
