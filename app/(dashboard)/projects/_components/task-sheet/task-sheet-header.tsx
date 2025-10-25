'use client'

import { type ReactNode } from 'react'

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type TaskSheetHeaderProps = {
  title: string
  description: ReactNode
}

export function TaskSheetHeader({ title, description }: TaskSheetHeaderProps) {
  return (
    <SheetHeader className='px-6 pt-6'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
