'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { Badge } from '@/components/ui/badge'
import {
  PROJECT_STATUS_OPTIONS,
  getProjectStatusLabel,
  getProjectStatusToken,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PROJECT_TYPE_OPTIONS } from '@/lib/settings/projects/project-sheet-form'
import type { ProjectSheetFormValues } from '@/lib/settings/projects/use-project-sheet-state'
import type {
  ClientOption,
  DeleteButtonState,
  OwnerOption,
  SubmitButtonState,
} from '@/lib/settings/projects/project-sheet-ui-state'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type { ProjectSheetFieldState } from './project-sheet-field-state'
import { GitHubReposSection, type PendingRepo } from './github-repos-section'
import {
  IntegrationLinksSection,
  type PendingIntegrationLink,
} from './integration-links-section'
import type { ProjectSheetLinkChanges } from '@/lib/settings/projects/use-project-sheet-state'

const PROJECT_FORM_ID = 'project-form'

export type ProjectSheetFormProps = {
  form: UseFormReturn<ProjectSheetFormValues>
  fieldState: ProjectSheetFieldState
  isEditing: boolean
  isPending: boolean
  feedback: string | null
  clientOptions: ClientOption[]
  ownerOptions: OwnerOption[]
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  onSubmit: (
    values: ProjectSheetFormValues,
    changes: ProjectSheetLinkChanges
  ) => void
  onRequestDelete: () => void
  onReposDirtyChange: (isDirty: boolean) => void
  isSheetOpen: boolean
  historyKey: string
  projectId?: string
}

export function ProjectSheetForm(props: ProjectSheetFormProps) {
  const {
    form,
    fieldState,
    isEditing,
    feedback,
    clientOptions,
    ownerOptions,
    submitButton,
    deleteButton,
    onSubmit,
    onRequestDelete,
    onReposDirtyChange,
    isSheetOpen,
    historyKey,
    projectId,
  } = props

  // Track repos in state for undo/redo integration
  const [pendingRepos, setPendingRepos] = useState<PendingRepo[]>([])
  const [removedRepoIds, setRemovedRepoIds] = useState<Set<string>>(new Set())

  // Hosting links (Vercel, Supabase) follow the same deferred-apply pattern.
  const [pendingLinks, setPendingLinks] = useState<PendingIntegrationLink[]>([])
  const [removedLinkIds, setRemovedLinkIds] = useState<Set<string>>(new Set())
  const [reposDirty, setReposDirty] = useState(false)

  // Refs for accessing current state in submit handler
  const pendingReposRef = useRef<PendingRepo[]>([])
  const removedRepoIdsRef = useRef<Set<string>>(new Set())
  const pendingLinksRef = useRef<PendingIntegrationLink[]>([])
  const removedLinkIdsRef = useRef<Set<string>>(new Set())

  // Keep refs in sync with state
  useEffect(() => {
    pendingReposRef.current = pendingRepos
  }, [pendingRepos])

  useEffect(() => {
    removedRepoIdsRef.current = removedRepoIds
  }, [removedRepoIds])

  useEffect(() => {
    pendingLinksRef.current = pendingLinks
  }, [pendingLinks])

  useEffect(() => {
    removedLinkIdsRef.current = removedLinkIds
  }, [removedLinkIds])

  // The parent tracks one "links dirty" flag covering repos and hosting.
  const linksDirty = pendingLinks.length > 0 || removedLinkIds.size > 0
  useEffect(() => {
    onReposDirtyChange(reposDirty || linksDirty)
  }, [reposDirty, linksDirty, onReposDirtyChange])

  const handlePendingReposChange = useCallback((repos: PendingRepo[]) => {
    setPendingRepos(repos)
  }, [])

  const handleRemovedRepoIdsChange = useCallback((ids: Set<string>) => {
    setRemovedRepoIds(ids)
  }, [])

  const handleSave = useCallback(
    (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()
      // Convert removedRepoIds Set to array for submission
      form.handleSubmit(values =>
        onSubmit(values, {
          pendingRepos: pendingReposRef.current,
          removedRepoIds: Array.from(removedRepoIdsRef.current),
          pendingIntegrationLinks: pendingLinksRef.current,
          removedIntegrationLinkIds: Array.from(removedLinkIdsRef.current),
        })
      )(e)
    },
    [form, onSubmit]
  )

  // External state for undo/redo (repos)
  // IMPORTANT: getExternalState must be stable (no state dependencies) because the
  // history hook's main effect depends on it. If it changes, the effect re-runs
  // and resets history. We use refs to access current state instead.
  type ReposExternalState = {
    pendingRepos: PendingRepo[]
    removedRepoIds: string[]
    pendingLinks?: PendingIntegrationLink[]
    removedLinkIds?: string[]
  }

  const getExternalState = useCallback(
    (): ReposExternalState => ({
      pendingRepos: pendingReposRef.current,
      removedRepoIds: Array.from(removedRepoIdsRef.current),
      pendingLinks: pendingLinksRef.current,
      removedLinkIds: Array.from(removedLinkIdsRef.current),
    }),
    []
  )

  const applyExternalState = useCallback((state: unknown) => {
    const reposState = state as ReposExternalState | undefined
    if (reposState) {
      setPendingRepos(reposState.pendingRepos)
      setRemovedRepoIds(new Set(reposState.removedRepoIds))
      setPendingLinks(reposState.pendingLinks ?? [])
      setRemovedLinkIds(new Set(reposState.removedLinkIds ?? []))
    }
  }, [])

  const { undo, redo, canUndo, canRedo, notifyExternalChange } =
    useSheetFormControls({
      form,
      isActive: isSheetOpen,
      canSave: !submitButton.disabled,
      onSave: handleSave,
      historyKey,
      getExternalState,
      applyExternalState,
    })

  // Notify undo/redo system when repos change
  useEffect(() => {
    notifyExternalChange()
  }, [
    pendingRepos,
    removedRepoIds,
    pendingLinks,
    removedLinkIds,
    notifyExternalChange,
  ])

  const firstFieldRef = useRef<HTMLInputElement>(null)
  const projectType =
    useWatch({
      control: form.control,
      name: 'projectType',
    }) ?? 'CLIENT'

  useEffect(() => {
    if (isSheetOpen && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isSheetOpen])

  useEffect(() => {
    if (projectType !== 'CLIENT') {
      const currentClientId = form.getValues('clientId')
      if (currentClientId) {
        form.setValue('clientId', '', { shouldDirty: true })
      }
      form.clearErrors('clientId')
    }
  }, [form, projectType])

  return (
    <Form {...form}>
      <div className='flex-1 overflow-y-auto'>
        <form
          id={PROJECT_FORM_ID}
          onSubmit={handleSave}
          className='flex flex-col gap-5 px-6 pt-6 pb-8'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={fieldState.name.disabled}
                    reason={fieldState.name.reason}
                  >
                    <Input
                      {...field}
                      ref={node => {
                        firstFieldRef.current = node
                        if (typeof field.ref === 'function') {
                          field.ref(node)
                        } else if (field.ref) {
                          ;(
                            field.ref as React.MutableRefObject<HTMLInputElement | null>
                          ).current = node
                        }
                      }}
                      placeholder='Website redesign'
                      disabled={fieldState.name.disabled}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isEditing ? (
            <FormField
              control={form.control}
              name='slug'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={fieldState.slug.disabled}
                      reason={fieldState.slug.reason}
                    >
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder='website-redesign'
                        disabled={fieldState.slug.disabled}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <div className='grid items-start gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='projectType'
              render={({ field }) => {
                const selectedType =
                  PROJECT_TYPE_OPTIONS.find(
                    option => option.value === field.value
                  ) ?? PROJECT_TYPE_OPTIONS[0]

                return (
                  <FormItem>
                    <FormLabel>Project type</FormLabel>
                    <Select
                      value={field.value ?? 'CLIENT'}
                      onValueChange={field.onChange}
                      disabled={fieldState.type.disabled}
                    >
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={fieldState.type.disabled}
                          reason={fieldState.type.reason}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Select type' />
                          </SelectTrigger>
                        </DisabledFieldTooltip>
                      </FormControl>
                      <SelectContent align='start'>
                        {PROJECT_TYPE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {selectedType?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name='clientId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={fieldState.client.disabled}
                      reason={fieldState.client.reason}
                    >
                      <SearchableCombobox
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        items={clientOptions}
                        searchPlaceholder='Search clients...'
                        emptyMessage='No clients found.'
                        disabled={fieldState.client.disabled}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='status'
            render={({ field }) => {
              const selectedLabel = field.value
                ? getProjectStatusLabel(field.value)
                : null
              const selectedToken = field.value
                ? getProjectStatusToken(field.value)
                : null

              return (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={fieldState.status.disabled}
                  >
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={fieldState.status.disabled}
                        reason={fieldState.status.reason}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select status'>
                            {selectedLabel && selectedToken ? (
                              <Badge className={cn('text-xs', selectedToken)}>
                                {selectedLabel}
                              </Badge>
                            ) : null}
                          </SelectValue>
                        </SelectTrigger>
                      </DisabledFieldTooltip>
                    </FormControl>
                    <SelectContent align='start'>
                      {PROJECT_STATUS_OPTIONS.map(status => {
                        const statusToken = getProjectStatusToken(status.value)
                        return (
                          <SelectItem key={status.value} value={status.value}>
                            <Badge className={cn('text-xs', statusToken)}>
                              {status.label}
                            </Badge>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='ownerId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Owner</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={fieldState.owner.disabled}
                    reason={fieldState.owner.reason}
                  >
                    <SearchableCombobox
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      items={ownerOptions}
                      searchPlaceholder='Search team members...'
                      emptyMessage='No team members found.'
                      disabled={fieldState.owner.disabled}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='startsOn'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date (optional)</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={fieldState.date.disabled}
                      reason={fieldState.date.reason}
                    >
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        type='date'
                        disabled={fieldState.date.disabled}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='endsOn'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date (optional)</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={fieldState.date.disabled}
                      reason={fieldState.date.reason}
                    >
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        type='date'
                        disabled={fieldState.date.disabled}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <GitHubReposSection
            projectId={projectId}
            pendingRepos={pendingRepos}
            removedRepoIds={removedRepoIds}
            onPendingReposChange={handlePendingReposChange}
            onRemovedRepoIdsChange={handleRemovedRepoIdsChange}
            onDirtyChange={setReposDirty}
          />

          <IntegrationLinksSection
            provider='VERCEL'
            projectId={projectId}
            pendingLinks={pendingLinks}
            removedLinkIds={removedLinkIds}
            onPendingLinksChange={setPendingLinks}
            onRemovedLinkIdsChange={setRemovedLinkIds}
          />

          <IntegrationLinksSection
            provider='SUPABASE'
            projectId={projectId}
            pendingLinks={pendingLinks}
            removedLinkIds={removedLinkIds}
            onPendingLinksChange={setPendingLinks}
            onRemovedLinkIdsChange={setRemovedLinkIds}
          />

          {feedback ? (
            <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
              {feedback}
            </p>
          ) : null}
        </form>
      </div>
      <SheetFormFooter
        formId={PROJECT_FORM_ID}
        saveLabel={submitButton.label}
        submitDisabled={submitButton.disabled}
        submitDisabledReason={submitButton.reason}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditing={isEditing}
        deleteDisabled={deleteButton.disabled}
        deleteDisabledReason={deleteButton.reason}
        onRequestDelete={onRequestDelete}
        deleteAriaLabel='Click to archive this project'
      />
    </Form>
  )
}
