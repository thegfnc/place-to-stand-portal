import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'
import { cn } from '@/lib/utils'

import { formatCurrency } from './format'
import { PAPER_LABEL } from './styles'

type LineItem = InvoiceWithLineItems['line_items'][number]

const NUM = 'font-mono tabular-nums'

/** A table from `sm` up; stacked rows on phones, where four columns don't fit. */
export function InvoiceLineItems({ items }: { items: LineItem[] }) {
  return (
    <>
      <table className='mt-10 hidden w-full border-collapse sm:table'>
        <thead>
          <tr className='border-b-[1.5px] border-[#0e0f11]'>
            <th
              scope='col'
              className={cn(PAPER_LABEL, 'pr-4 pb-2.5 text-left font-medium')}
            >
              Description
            </th>
            <th
              scope='col'
              className={cn(PAPER_LABEL, 'w-14 pr-4 pb-2.5 text-right font-medium')}
            >
              Qty
            </th>
            <th
              scope='col'
              className={cn(
                PAPER_LABEL,
                'w-[104px] pr-4 pb-2.5 text-right font-medium'
              )}
            >
              Rate
            </th>
            <th
              scope='col'
              className={cn(PAPER_LABEL, 'w-28 pb-2.5 text-right font-medium')}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className='border-b border-[#e4e4e7]'>
              <td className='py-3.5 pr-4 text-[15px] leading-[1.45]'>
                {item.description}
              </td>
              <td
                className={cn(NUM, 'py-3.5 pr-4 text-right text-sm text-[#3a3b40]')}
              >
                {Number(item.quantity)}
              </td>
              <td
                className={cn(NUM, 'py-3.5 pr-4 text-right text-sm text-[#3a3b40]')}
              >
                {formatCurrency(item.unit_price)}
              </td>
              <td className={cn(NUM, 'py-3.5 text-right text-sm font-medium')}>
                {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className='mt-7 border-t-[1.5px] border-[#0e0f11] sm:hidden'>
        {items.map(item => (
          <li
            key={item.id}
            className='flex flex-col gap-1.5 border-b border-[#e4e4e7] py-3.5'
          >
            <span className='text-sm leading-[1.45]'>{item.description}</span>
            <div className='flex items-baseline justify-between gap-4'>
              <span className={cn(NUM, 'text-[13px] text-[#5b5d63]')}>
                {Number(item.quantity)} × {formatCurrency(item.unit_price)}
              </span>
              <span className={cn(NUM, 'text-sm font-medium')}>
                {formatCurrency(item.amount)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
