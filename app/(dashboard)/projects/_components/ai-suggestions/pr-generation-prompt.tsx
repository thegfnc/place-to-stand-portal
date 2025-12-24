'use client'

import { useState } from 'react'
import { CheckCircle, GitPullRequest, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type GitHubRepoInfo = {
  id: string
  repoFullName: string
  defaultBranch: string
}

type PRGenerationPromptProps = {
  taskTitle: string
  repos: GitHubRepoInfo[]
  isGenerating: boolean
  onGenerate: (repoLinkId: string) => void
  onSkip: () => void
}

export function PRGenerationPrompt({
  taskTitle,
  repos,
  isGenerating,
  onGenerate,
  onSkip,
}: PRGenerationPromptProps) {
  const [selectedRepoId, setSelectedRepoId] = useState<string>(
    repos.length === 1 ? repos[0].id : ''
  )

  const handleGenerate = () => {
    if (selectedRepoId) {
      onGenerate(selectedRepoId)
    }
  }

  return (
    <div className='flex flex-col items-center justify-center py-8 px-4 text-center'>
      {/* Success icon */}
      <div className='mb-4 rounded-full bg-green-100 p-3 dark:bg-green-500/10'>
        <CheckCircle className='h-8 w-8 text-green-600 dark:text-green-400' />
      </div>

      {/* Success message */}
      <h3 className='mb-1 text-lg font-semibold'>Task Created</h3>
      <p className='mb-6 text-sm text-muted-foreground'>
        &ldquo;{taskTitle}&rdquo;
      </p>

      {/* PR generation prompt */}
      <div className='w-full max-w-sm space-y-4 rounded-lg border bg-muted/30 p-4'>
        <div className='flex items-center gap-2 text-sm font-medium'>
          <GitPullRequest className='h-4 w-4' />
          Generate a PR for this task?
        </div>

        {repos.length > 1 ? (
          <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
            <SelectTrigger>
              <SelectValue placeholder='Select a repository' />
            </SelectTrigger>
            <SelectContent>
              {repos.map(repo => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.repoFullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className='text-sm text-muted-foreground'>
            Repository: <span className='font-medium'>{repos[0].repoFullName}</span>
          </p>
        )}

        <div className='flex gap-2'>
          <Button
            variant='outline'
            className='flex-1'
            onClick={onSkip}
            disabled={isGenerating}
          >
            Skip
          </Button>
          <Button
            className='flex-1'
            onClick={handleGenerate}
            disabled={!selectedRepoId || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Generating...
              </>
            ) : (
              <>
                <GitPullRequest className='mr-2 h-4 w-4' />
                Generate PR
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
