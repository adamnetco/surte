/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as organizationWelcome } from './organization-welcome.tsx'
import { template as dunningNotice } from './dunning-notice.tsx'
import { template as trialOnboarding } from './trial-onboarding.tsx'
import { template as trialEnding } from './trial-ending.tsx'
import { template as winbackInactive } from './winback-inactive.tsx'
import { template as approachingLimit } from './approaching-limit.tsx'
import { template as cancellationFollowup } from './cancellation-followup.tsx'
import { template as apiAlertCritical } from './api-alert-critical.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-confirmation': orderConfirmation,
  'organization-welcome': organizationWelcome,
  'dunning-notice': dunningNotice,
  'trial-onboarding': trialOnboarding,
  'trial-ending': trialEnding,
  'winback-inactive': winbackInactive,
  'approaching-limit': approachingLimit,
  'cancellation-followup': cancellationFollowup,
  'api-alert-critical': apiAlertCritical,
}
