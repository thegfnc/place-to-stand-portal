'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Github, Loader2, GitBranch } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PRSuggestionWithContext } from '@/lib/types/github'

type PRPreviewDialogProps = {
  suggestion: PRSuggestionWithContext
  isApproving: boolean
  onApprove: (modifications?: {
    title?: string
    body?: string
    branch?: string
    baseBranch?: string
    createNewBranch?: boolean
  }) => Promise<{ prNumber: number; prUrl: string } | null>
  onCancel: () => void
}

type BranchInfo = {
  name: string
  protected: boolean
}

export function PRPreviewDialog({
  suggestion,
  isApproving,
  onApprove,
  onCancel,
}: PRPreviewDialogProps) {
  const [title, setTitle] = useState(suggestion.suggestedTitle)
  const [body, setBody] = useState(suggestion.suggestedBody)
  const [branch, setBranch] = useState(suggestion.suggestedBranch || '')
  const [baseBranch, setBaseBranch] = useState(
    suggestion.suggestedBaseBranch || 'main'
  )
  const [createNewBranch, setCreateNewBranch] = useState(true)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [useExistingBranch, setUseExistingBranch] = useState(false)
  const [createdPR, setCreatedPR] = useState<{
    prNumber: number
    prUrl: string
    branchCreated?: boolean
  } | null>(null)

  // Fetch branches when component mounts
  useEffect(() => {
    const fetchBranches = async () => {
      const [owner, repo] = suggestion.repoLink.repoFullName.split('/')
      if (!owner || !repo) return

      setLoadingBranches(true)
      try {
        const res = await fetch(`/api/github/repos/${owner}/${repo}/branches`)
        if (res.ok) {
          const data = await res.json()
          setBranches(data.branches || [])
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err)
      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [suggestion.repoLink.repoFullName])

  // Reset state when suggestion changes
  useEffect(() => {
    setTitle(suggestion.suggestedTitle)
    setBody(suggestion.suggestedBody)
    setBranch(suggestion.suggestedBranch || '')
    setBaseBranch(suggestion.suggestedBaseBranch || 'main')
    setCreatedPR(null)
    setCreateNewBranch(true)
    setUseExistingBranch(false)
  }, [suggestion])

  const handleApprove = async () => {
    const result = await onApprove({
      title,
      body,
      branch,
      baseBranch,
      createNewBranch: createNewBranch && !useExistingBranch,
    })
    if (result) {
      setCreatedPR(result)
    }
  }

  // Check if selected branch exists
  const branchExists = branches.some(b => b.name === branch)

  const confidence = parseFloat(suggestion.confidence)
  const confidenceColor =
    confidence >= 0.8
      ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
      : confidence >= 0.6
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'

  // Show success state after PR creation
  if (createdPR) {
    return (
      <div className='flex flex-col items-center justify-center py-12 px-4 text-center'>
        <div className='mb-4 rounded-full bg-green-100 p-4 dark:bg-green-500/10'>
          <Github className='h-8 w-8 text-green-600 dark:text-green-400' />
        </div>
        <h3 className='mb-2 text-lg font-semibold'>PR Created!</h3>
        <p className='mb-2 text-sm text-muted-foreground'>
          Pull Request #{createdPR.prNumber} has been created on GitHub.
        </p>
        {createdPR.branchCreated && (
          <p className='mb-4 text-xs text-muted-foreground'>
            <GitBranch className='mr-1 inline h-3 w-3' />
            New branch &ldquo;{branch}&rdquo; was created from {baseBranch}
          </p>
        )}
        <div className='flex gap-2'>
          <Button variant='outline' onClick={onCancel}>
            Done
          </Button>
          <Button asChild>
            <a
              href={createdPR.prUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              View on GitHub
              <ExternalLink className='ml-2 h-4 w-4' />
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4 p-1'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Github className='h-5 w-5' />
          <h3 className='font-semibold'>Create Pull Request</h3>
        </div>
        <Badge variant='secondary' className={confidenceColor}>
          {Math.round(confidence * 100)}% confidence
        </Badge>
      </div>

      {/* Repository */}
      <p className='text-sm text-muted-foreground'>
        Repository:{' '}
        <a
          href={`https://github.com/${suggestion.repoLink.repoFullName}`}
          target='_blank'
          rel='noopener noreferrer'
          className='font-medium underline hover:no-underline'
        >
          {suggestion.repoLink.repoFullName}
          <ExternalLink className='ml-1 inline h-3 w-3' />
        </a>
      </p>

      {/* Title */}
      <div className='space-y-2'>
        <Label htmlFor='pr-title'>PR Title</Label>
        <Input
          id='pr-title'
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='feat: add new feature'
        />
      </div>

      {/* Branch Selection Mode */}
      <div className='flex items-center gap-4 rounded-lg border bg-muted/30 p-3'>
        <div className='flex items-center space-x-2'>
          <Checkbox
            id='use-existing'
            checked={useExistingBranch}
            onCheckedChange={(checked) => setUseExistingBranch(checked === true)}
          />
          <Label htmlFor='use-existing' className='text-sm font-normal'>
            Use existing branch
          </Label>
        </div>
        {!useExistingBranch && (
          <div className='flex items-center space-x-2'>
            <Checkbox
              id='create-branch'
              checked={createNewBranch}
              onCheckedChange={(checked) => setCreateNewBranch(checked === true)}
            />
            <Label htmlFor='create-branch' className='text-sm font-normal'>
              Create new branch from base
            </Label>
          </div>
        )}
      </div>

      {/* Branches */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='pr-branch'>Head Branch</Label>
          {useExistingBranch ? (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger>
                <SelectValue placeholder={loadingBranches ? 'Loading...' : 'Select branch'} />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter(b => b.name !== baseBranch)
                  .map(b => (
                    <SelectItem key={b.name} value={b.name}>
                      <span className='flex items-center gap-2'>
                        <GitBranch className='h-3 w-3' />
                        {b.name}
                        {b.protected && (
                          <Badge variant='outline' className='ml-1 text-xs'>protected</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className='relative'>
              <Input
                id='pr-branch'
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder='feature/my-branch'
              />
              {branchExists && (
                <p className='mt-1 text-xs text-amber-600 dark:text-amber-400'>
                  Branch already exists - will use existing
                </p>
              )}
            </div>
          )}
          <p className='text-xs text-muted-foreground'>
            {useExistingBranch ? 'Select an existing branch' : 'New branch will be created'}
          </p>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='pr-base'>Base Branch</Label>
          <Select value={baseBranch} onValueChange={setBaseBranch}>
            <SelectTrigger>
              <SelectValue placeholder={loadingBranches ? 'Loading...' : 'Select base'} />
            </SelectTrigger>
            <SelectContent>
              {branches.map(b => (
                <SelectItem key={b.name} value={b.name}>
                  <span className='flex items-center gap-2'>
                    <GitBranch className='h-3 w-3' />
                    {b.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-xs text-muted-foreground'>Branch to merge into</p>
        </div>
      </div>

      {/* Body */}
      <div className='space-y-2'>
        <Label htmlFor='pr-body'>Description</Label>
        <Textarea
          id='pr-body'
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={10}
          className='font-mono text-sm'
          placeholder='## Summary&#10;&#10;Description of changes...'
        />
        <p className='text-xs text-muted-foreground'>Markdown supported</p>
      </div>

      {/* Reasoning */}
      {suggestion.reasoning && (
        <p className='text-xs italic text-muted-foreground'>
          AI reasoning: &ldquo;{suggestion.reasoning}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className='flex justify-end gap-2 border-t pt-4'>
        <Button variant='outline' onClick={onCancel} disabled={isApproving}>
          Cancel
        </Button>
        <Button onClick={handleApprove} disabled={isApproving || !branch}>
          {isApproving ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Creating PR...
            </>
          ) : (
            'Create Pull Request'
          )}
        </Button>
      </div>
    </div>
  )
}
