import { Loader2, PlusCircle, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import { type SearchableComboboxItem } from '@/components/ui/searchable-combobox'
import { Textarea } from '@/components/ui/textarea'
import type { TaskWithRelations } from '@/lib/types'
import type { TimeLogFormErrors } from '@/lib/projects/time-log/types'

import { SelectedTaskList } from './selected-task-list'
import { TaskSelector } from './task-selector'
import { UserSelectField } from './user-select-field'

export type ProjectTimeLogFormProps = {
  canLogTime: boolean
  canSelectUser: boolean
  isMutating: boolean
  disableSubmit: boolean
  formErrors: TimeLogFormErrors
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
    note?: string
    general?: string
  }
  hoursInput: string
  onHoursChange: (value: string) => void
  loggedOnInput: string
  onLoggedOnChange: (value: string) => void
  noteInput: string
  onNoteChange: (value: string) => void
  selectedUserId: string
  onSelectUser: (value: string) => void
  userComboboxItems: SearchableComboboxItem[]
  getToday: () => string
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  availableTasks: TaskWithRelations[]
  selectedTasks: TaskWithRelations[]
  onAddTask: (taskId: string) => void
  isTaskPickerOpen: boolean
  onTaskPickerOpenChange: (open: boolean) => void
  taskPickerButtonDisabled: boolean
  taskPickerReason: string | null
  requestTaskRemoval: (task: TaskWithRelations) => void
  submitLabel: string
  isEditMode: boolean
}

export function ProjectTimeLogForm(props: ProjectTimeLogFormProps) {
  const {
    canLogTime,
    canSelectUser,
    isMutating,
    disableSubmit,
    formErrors,
    fieldErrorIds,
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    userComboboxItems,
    getToday,
    handleSubmit,
    availableTasks,
    selectedTasks,
    onAddTask,
    isTaskPickerOpen,
    onTaskPickerOpenChange,
    taskPickerButtonDisabled,
    taskPickerReason,
    requestTaskRemoval,
    submitLabel,
    isEditMode,
  } = props

  const submitTooltipReason = canLogTime
    ? disableSubmit
      ? 'Complete the form before submitting.'
      : null
    : 'Only internal teammates can log time.'

  const SubmitIcon = isEditMode ? Pencil : PlusCircle

  return (
    <form onSubmit={handleSubmit} className='grid gap-4 sm:grid-cols-2'>
      <div className='space-y-2'>
        <label htmlFor='time-log-hours' className='text-sm font-medium'>
          Hours
        </label>
        <Input
          id='time-log-hours'
          type='number'
          step='0.25'
          min='0'
          inputMode='decimal'
          value={hoursInput}
          onChange={event => onHoursChange(event.currentTarget.value)}
          placeholder='e.g. 1.5'
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.hours)}
          aria-describedby={fieldErrorIds.hours}
          required
        />
        {formErrors.hours ? (
          <p
            id={fieldErrorIds.hours}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.hours}
          </p>
        ) : null}
      </div>
      <div className='space-y-2'>
        <label htmlFor='time-log-date' className='text-sm font-medium'>
          Date
        </label>
        <Input
          id='time-log-date'
          type='date'
          value={loggedOnInput}
          max={getToday()}
          onChange={event => onLoggedOnChange(event.currentTarget.value)}
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.loggedOn)}
          aria-describedby={fieldErrorIds.loggedOn}
          required
        />
        {formErrors.loggedOn ? (
          <p
            id={fieldErrorIds.loggedOn}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.loggedOn}
          </p>
        ) : null}
      </div>
      {canSelectUser ? (
        <UserSelectField
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          items={userComboboxItems}
          disabled={isMutating}
          fieldErrorId={fieldErrorIds.user}
          errorMessage={formErrors.user}
        />
      ) : null}
      <div className='space-y-2 sm:col-span-2'>
        <label htmlFor='time-log-task' className='text-sm font-medium'>
          Link to tasks (optional)
        </label>
        <TaskSelector
          availableTasks={availableTasks}
          onAddTask={onAddTask}
          isOpen={isTaskPickerOpen}
          onOpenChange={onTaskPickerOpenChange}
          disabled={taskPickerButtonDisabled}
          disabledReason={taskPickerReason}
        />
        <p className='text-muted-foreground text-xs'>
          Leave empty to apply hours to the project only.
        </p>
        <SelectedTaskList
          tasks={selectedTasks}
          isActionDisabled={isMutating}
          disabledReason={isMutating ? 'Logging time...' : null}
          onRemove={requestTaskRemoval}
        />
      </div>
      <div className='space-y-2 sm:col-span-2'>
        <label htmlFor='time-log-note' className='text-sm font-medium'>
          Notes
        </label>
        <Textarea
          id='time-log-note'
          value={noteInput}
          onChange={event => onNoteChange(event.target.value)}
          rows={3}
          placeholder='Capture any context, like what was accomplished.'
          disabled={isMutating}
          aria-invalid={Boolean(formErrors.note)}
          aria-describedby={fieldErrorIds.note}
        />
        {formErrors.note ? (
          <p
            id={fieldErrorIds.note}
            className='text-destructive text-xs'
            role='alert'
          >
            {formErrors.note}
          </p>
        ) : null}
      </div>
      {formErrors.general ? (
        <div
          id={fieldErrorIds.general}
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm sm:col-span-2'
          role='alert'
          aria-live='assertive'
        >
          {formErrors.general}
        </div>
      ) : null}
      <div className='flex items-center justify-end gap-3 sm:col-span-2'>
        <DisabledFieldTooltip
          disabled={disableSubmit}
          reason={submitTooltipReason}
        >
          <Button
            type='submit'
            disabled={disableSubmit}
            className='inline-flex items-center gap-2'
          >
            {isMutating ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <SubmitIcon className='size-4' />
            )}
            {submitLabel}
          </Button>
        </DisabledFieldTooltip>
      </div>
    </form>
  )
}
