import type { InvoiceWithLineItems } from '@pts/pdf'

/**
 * Placeholder invoice for template previews. Obviously fake on purpose: the
 * number, client, and amounts should never be mistaken for a real record.
 */
export function buildSampleInvoice(
  overrides: Partial<Pick<InvoiceWithLineItems, 'status' | 'paid_at'>> = {}
): InvoiceWithLineItems {
  const now = '2026-09-01T16:00:00.000Z'

  return {
    id: '00000000-0000-4000-8000-000000000001',
    invoice_number: 'INV-0042',
    status: 'SENT',
    client_id: '00000000-0000-4000-8000-000000000002',
    created_by: null,
    issued_date: '2026-09-01',
    due_date: null,
    subtotal: '3400.00',
    tax_rate: '0.0825',
    tax_amount: '280.50',
    total: '3680.50',
    notes:
      'Thank you for your business. Hours purchased on this invoice are added to your prepaid balance as soon as payment clears.',
    share_token: 'sample-token',
    share_enabled: true,
    billing_type: 'prepaid',
    viewed_at: null,
    viewed_count: 0,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    paid_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    client: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Acme Co.',
      slug: 'acme-co',
      deleted_at: null,
    },
    line_items: [
      {
        id: '00000000-0000-4000-8000-000000000011',
        invoice_id: '00000000-0000-4000-8000-000000000001',
        product_catalog_item_id: null,
        description: 'Prepaid hour block — 20 hours',
        quantity: '20',
        unit_price: '150.00',
        amount: '3000.00',
        sort_order: 0,
        creates_hour_block: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000012',
        invoice_id: '00000000-0000-4000-8000-000000000001',
        product_catalog_item_id: null,
        description: 'Hosting and monitoring — September',
        quantity: '1',
        unit_price: '400.00',
        amount: '400.00',
        sort_order: 1,
        creates_hour_block: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ],
    ...overrides,
  }
}
