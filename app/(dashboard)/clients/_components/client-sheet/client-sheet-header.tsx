'use client'

import { type ReactNode } from 'react'

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type ClientSheetHeaderProps = {
  title: string
  description: ReactNode
}

export function ClientSheetHeader({
  title,
  description,
}: ClientSheetHeaderProps) {
  return (
    <SheetHeader className='px-6 pt-6'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
