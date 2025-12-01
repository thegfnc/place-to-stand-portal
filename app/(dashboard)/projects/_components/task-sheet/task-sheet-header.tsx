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
    <SheetHeader className='border-b-2 border-b-violet-500/60 px-6 pt-4'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
