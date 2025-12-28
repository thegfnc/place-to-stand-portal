'use client'

import { RefreshCw, Sparkles, Loader2, Mail, AlertCircle, ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'

import type { UseAISuggestionsSheetReturn } from '@/lib/projects/board/state/use-ai-suggestions-sheet'
import { EmailSuggestionCard } from './email-suggestion-card'
import { PRGenerationPrompt } from './pr-generation-prompt'
import { PRPreviewDialog } from './pr-preview-dialog'

type AISuggestionsSheetProps = UseAISuggestionsSheetReturn & {
  projectName: string | null
}

export function AISuggestionsSheet({
  isOpen,
  onOpenChange,
  emails,
  pendingCount,
  unanalyzedCount,
  isLoading,
  isAnalyzing,
  isCreatingTask,
  error,
  onRefresh,
  onAnalyzeEmails,
  onCreateTask,
  onRejectSuggestion,
  projectName,
  // PR generation props
  createdTaskInfo,
  isGeneratingPR,
  isApprovingPR,
  prSuggestion,
  onGeneratePR,
  onApprovePR,
  onDismissPR,
}: AISuggestionsSheetProps) {
  const hasEmails = emails.length > 0
  const showPRPrompt = createdTaskInfo && !prSuggestion
  const showPRPreview = !!prSuggestion

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]'>
        <SheetHeader className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-amber-500' />
            <SheetTitle>AI Suggestions</SheetTitle>
          </div>
          <SheetDescription>
            {pendingCount > 0
              ? `${pendingCount} pending suggestion${pendingCount !== 1 ? 's' : ''} from client emails`
              : 'Review task suggestions extracted from client emails'}
          </SheetDescription>
        </SheetHeader>

        {/* Action Bar */}
        <div className='flex items-center justify-between border-b px-6 py-3'>
          <div className='text-sm text-muted-foreground'>
            {(showPRPrompt || showPRPreview) ? (
              <Button
                variant='ghost'
                size='sm'
                onClick={onDismissPR}
                className='-ml-2'
              >
                <ArrowLeft className='mr-1 h-3 w-3' />
                Back to suggestions
              </Button>
            ) : (
              projectName && <span className='font-medium'>{projectName}</span>
            )}
          </div>
          {!(showPRPrompt || showPRPreview) && (
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {unanalyzedCount > 0 && (
                <Button
                  variant='default'
                  size='sm'
                  onClick={onAnalyzeEmails}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className='mr-1 h-3 w-3' />
                      Analyze {unanalyzedCount} email{unanalyzedCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant='destructive' className='mx-6 mt-4'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        <ScrollArea className='min-h-0 flex-1'>
          <div className='p-6 pb-8'>
            {/* PR Generation Prompt - shown after task creation */}
            {showPRPrompt ? (
              <PRGenerationPrompt
                taskTitle={createdTaskInfo.title}
                repos={createdTaskInfo.githubRepos}
                isGenerating={isGeneratingPR}
                onGenerate={onGeneratePR}
                onSkip={onDismissPR}
              />
            ) : /* PR Preview Dialog - shown after PR generation */
            showPRPreview ? (
              <PRPreviewDialog
                suggestion={prSuggestion}
                isApproving={isApprovingPR}
                onApprove={onApprovePR}
                onCancel={onDismissPR}
              />
            ) : /* Normal content - email suggestions list */
            isLoading ? (
              <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
                <Loader2 className='mb-3 h-8 w-8 animate-spin' />
                <p className='text-sm'>Loading suggestions...</p>
              </div>
            ) : hasEmails ? (
              <div className='space-y-4'>
                {emails.map(email => (
                  <EmailSuggestionCard
                    key={email.id}
                    email={email}
                    isCreatingTask={isCreatingTask}
                    onCreateTask={onCreateTask}
                    onReject={onRejectSuggestion}
                  />
                ))}
              </div>
            ) : (
              <EmptyState unanalyzedCount={unanalyzedCount} onAnalyze={onAnalyzeEmails} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({
  unanalyzedCount,
  onAnalyze,
}: {
  unanalyzedCount: number
  onAnalyze: () => void
}) {
  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      <div className='mb-4 rounded-full bg-muted p-4'>
        <Mail className='h-8 w-8 text-muted-foreground' />
      </div>
      <h3 className='mb-1 font-medium'>No pending suggestions</h3>
      <p className='mb-4 text-sm text-muted-foreground'>
        {unanalyzedCount > 0
          ? `There are ${unanalyzedCount} unanalyzed email${unanalyzedCount !== 1 ? 's' : ''} that may contain tasks.`
          : 'Link emails to this client to generate task suggestions.'}
      </p>
      {unanalyzedCount > 0 && (
        <Button onClick={onAnalyze}>
          <Sparkles className='mr-2 h-4 w-4' />
          Analyze Emails
        </Button>
      )}
    </div>
  )
}
