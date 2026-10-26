import type { Webhook } from '../api/webhooks'

export type MockWebhook = Webhook & { user_id: number }

const SEED: [name: string, url: string, active: boolean][] = [
  ['Order created', 'https://hooks.shopify-sync.io/orders/created', true],
  ['Order paid', 'https://hooks.shopify-sync.io/orders/paid', true],
  ['Order refunded', 'https://hooks.shopify-sync.io/orders/refunded', false],
  ['Customer signup', 'https://crm.example.com/webhooks/customers', true],
  ['Customer deleted', 'https://crm.example.com/webhooks/customers/deleted', true],
  ['Newsletter subscribe', 'https://api.mailer.dev/v2/subscribe', true],
  ['Newsletter unsubscribe', 'https://api.mailer.dev/v2/unsubscribe', false],
  ['Slack #sales alerts', 'https://hooks.slack.com/services/T000/B001/sales', true],
  ['Slack #support alerts', 'https://hooks.slack.com/services/T000/B002/support', true],
  ['Discord deploy feed', 'https://discord.com/api/webhooks/1001/deploys', false],
  ['Invoice issued', 'https://billing.example.com/hooks/invoice-issued', true],
  ['Invoice overdue', 'https://billing.example.com/hooks/invoice-overdue', true],
  ['Payment failed', 'https://billing.example.com/hooks/payment-failed', true],
  ['Subscription renewed', 'https://billing.example.com/hooks/subscription-renewed', true],
  ['Subscription cancelled', 'https://billing.example.com/hooks/subscription-cancelled', false],
  ['Lead form submitted', 'https://zapier.com/hooks/catch/123456/lead', true],
  ['Ticket opened', 'https://helpdesk.example.org/api/tickets/opened', true],
  ['Ticket closed', 'https://helpdesk.example.org/api/tickets/closed', true],
  ['Inventory low', 'https://warehouse.example.net/alerts/inventory-low', true],
  ['Shipment dispatched', 'https://logistics.example.net/webhooks/dispatched', true],
  ['Shipment delivered', 'https://logistics.example.net/webhooks/delivered', false],
  ['Analytics event sink', 'https://events.analytics.dev/ingest', true],
  ['Audit log mirror', 'https://audit.internal.example.com/mirror', true],
]

const FIRST_CREATED_AT = Date.UTC(2026, 0, 5, 9, 30)
const DAY_MS = 24 * 60 * 60 * 1000

export const WEBHOOKS: readonly MockWebhook[] = SEED.map(([name, url, active], i) => ({
  id: i + 1,
  user_id: 1,
  name,
  url,
  active,
  created_at: new Date(FIRST_CREATED_AT + i * 7 * DAY_MS + i * 37 * 60 * 1000).toISOString(),
}))
