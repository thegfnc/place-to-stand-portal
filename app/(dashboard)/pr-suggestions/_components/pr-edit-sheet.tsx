'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Github, ExternalLink } from 'lucide-react'
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
  FormDescription,
} from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import type { PRSuggestionWithContext } from '@/lib/types/github'

const editSchema = z.object({
  title: z.string().min(1, 'Title required').max(100),
  body: z.string().max(10000),
  branch: z.string().min(1, 'Branch name required').max(100),
  baseBranch: z.string().min(1).max(100),
})

type EditFormValues = z.infer<typeof editSchema>

interface PREditSheetProps {
  suggestion: PRSuggestionWithContext | null
  onClose: () => void
  onApproved: (suggestionId: string, prUrl: string) => void
}

export function PREditSheet({ suggestion, onClose, onApproved }: PREditSheetProps) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: '',
      body: '',
      branch: '',
      baseBranch: 'main',
    },
  })

  useEffect(() => {
    if (suggestion) {
      form.reset({
        title: suggestion.suggestedTitle,
        body: suggestion.suggestedBody,
        branch: suggestion.suggestedBranch || '',
        baseBranch: suggestion.suggestedBaseBranch || 'main',
      })
    }
  }, [suggestion, form])

  const onSubmit = async (values: EditFormValues) => {
    if (!suggestion) return

    try {
      const response = await fetch(`/api/pr-suggestions/${suggestion.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create PR')
      }

      onApproved(suggestion.id, result.prUrl)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create PR',
        variant: 'destructive',
      })
    }
  }

  if (!suggestion) return null

  return (
    <Sheet open={!!suggestion} onOpenChange={() => onClose()}>
      <SheetContent className='w-[600px] overflow-y-auto sm:max-w-[600px]'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Github className='h-5 w-5' />
            Create Pull Request
          </SheetTitle>
          <SheetDescription>
            Review and edit before creating the PR on{' '}
            <a
              href={`https://github.com/${suggestion.repoLink.repoFullName}`}
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              {suggestion.repoLink.repoFullName}
              <ExternalLink className='ml-1 inline h-3 w-3' />
            </a>
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='mt-6 space-y-4'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PR Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='branch'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Head Branch</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='feature/my-branch' />
                    </FormControl>
                    <FormDescription>Branch with your changes</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='baseBranch'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Branch</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Branch to merge into</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='body'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PR Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={12} className='font-mono text-sm' />
                  </FormControl>
                  <FormDescription>Markdown supported</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2 pt-4'>
              <Button type='button' variant='outline' onClick={onClose}>
                Cancel
              </Button>
              <Button type='submit' disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Creating PR...
                  </>
                ) : (
                  'Create Pull Request'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
