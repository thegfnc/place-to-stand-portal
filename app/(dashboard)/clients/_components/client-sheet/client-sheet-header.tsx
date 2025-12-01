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
    <SheetHeader className='border-b-2 border-b-blue-500/60 px-6 pt-4'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
