'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { TaskSuggestionWithEmail } from '@/lib/types/suggestions'

const editSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().min(1, 'Select a project'),
  dueDate: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
})

type EditFormValues = z.infer<typeof editSchema>

interface SuggestionEditSheetProps {
  suggestion: TaskSuggestionWithEmail | null
  projects: Array<{ id: string; name: string }>
  onClose: () => void
  onComplete: (approved: boolean) => void
}

export function SuggestionEditSheet({
  suggestion,
  projects,
  onClose,
  onComplete,
}: SuggestionEditSheetProps) {
  const [error, setError] = useState<string | null>(null)

  const projectItems = projects.map(p => ({ value: p.id, label: p.name }))

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: '',
      description: '',
      projectId: '',
      dueDate: '',
      priority: undefined,
    },
  })

  useEffect(() => {
    if (suggestion) {
      form.reset({
        title: suggestion.suggestedTitle,
        description: suggestion.suggestedDescription || '',
        projectId: suggestion.projectId || '',
        dueDate: suggestion.suggestedDueDate || '',
        priority: suggestion.suggestedPriority as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
      })
      setError(null)
    }
  }, [suggestion, form])

  const onSubmit = async (values: EditFormValues) => {
    if (!suggestion) return
    setError(null)

    try {
      const response = await fetch(`/api/suggestions/${suggestion.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }

      onComplete(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    }
  }

  if (!suggestion) return null

  return (
    <Sheet open={!!suggestion} onOpenChange={() => onClose()}>
      <SheetContent className='w-[500px] sm:max-w-[500px]'>
        <SheetHeader>
          <SheetTitle>Edit & Approve Suggestion</SheetTitle>
          <SheetDescription>
            Review and modify the task details before creating.
          </SheetDescription>
        </SheetHeader>

        <div className='mt-4 p-3 bg-muted rounded-md text-sm'>
          <p className='font-medium'>Source Email:</p>
          <p className='text-muted-foreground'>{suggestion.email.subject}</p>
          <p className='text-xs text-muted-foreground'>{suggestion.email.fromEmail}</p>
        </div>

        {error && (
          <div className='mt-4 p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-md text-sm'>
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='mt-6 space-y-4'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='projectId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <SearchableCombobox
                      items={projectItems}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder='Select project...'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='dueDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input {...field} type='date' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select...' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='HIGH'>High</SelectItem>
                        <SelectItem value='MEDIUM'>Medium</SelectItem>
                        <SelectItem value='LOW'>Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='flex justify-end gap-2 pt-4'>
              <Button type='button' variant='outline' onClick={onClose}>
                Cancel
              </Button>
              <Button type='submit' disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
