import { ChevronsUpDown, ListPlus, Loader2, PlusCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { Textarea } from '@/components/ui/textarea'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { TaskWithRelations } from '@/lib/types'
import type { TimeLogFormErrors } from '@/lib/projects/time-log/types'

const formatTaskStatusLabel = (status: string | null) => {
  if (!status) {
    return null
  }

  return status
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

export type ProjectTimeLogFormProps = {
  canLogTime: boolean
  canSelectUser: boolean
  isMutating: boolean
  disableCreate: boolean
  formErrors: TimeLogFormErrors
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
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
}

export function ProjectTimeLogForm(props: ProjectTimeLogFormProps) {
  const {
    canLogTime,
    canSelectUser,
    isMutating,
    disableCreate,
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
  } = props

  const submitTooltipReason = canLogTime
    ? disableCreate
      ? 'Complete the form before submitting.'
      : null
    : 'Only internal teammates can log time.'

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
        <div className='space-y-2 sm:col-span-2'>
          <label htmlFor='time-log-user' className='text-sm font-medium'>
            Log hours for
          </label>
          <SearchableCombobox
            id='time-log-user'
            value={selectedUserId}
            onChange={onSelectUser}
            items={userComboboxItems}
            placeholder='Select teammate'
            searchPlaceholder='Search collaborators...'
            emptyMessage='No eligible collaborators found.'
            disabled={isMutating}
            ariaDescribedBy={fieldErrorIds.user}
            ariaInvalid={Boolean(formErrors.user)}
          />
          {formErrors.user ? (
            <p
              id={fieldErrorIds.user}
              className='text-destructive text-xs'
              role='alert'
            >
              {formErrors.user}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className='space-y-2 sm:col-span-2'>
        <label htmlFor='time-log-task' className='text-sm font-medium'>
          Link to tasks (optional)
        </label>
        <Popover open={isTaskPickerOpen} onOpenChange={onTaskPickerOpenChange}>
          <DisabledFieldTooltip
            disabled={taskPickerButtonDisabled}
            reason={taskPickerReason}
          >
            <div className='w-full'>
              <PopoverTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  className='w-full justify-between'
                  disabled={taskPickerButtonDisabled}
                >
                  <span className='flex items-center gap-2'>
                    <ListPlus className='h-4 w-4' />
                    {availableTasks.length > 0
                      ? 'Add task link'
                      : 'All tasks linked'}
                  </span>
                  <ChevronsUpDown className='h-4 w-4 opacity-50' />
                </Button>
              </PopoverTrigger>
            </div>
          </DisabledFieldTooltip>
          <PopoverContent className='w-[320px] p-0' align='start'>
            <Command>
              <CommandInput placeholder='Search tasks...' />
              <CommandEmpty>No matching tasks.</CommandEmpty>
              <CommandList>
                <CommandGroup heading='Tasks'>
                  {availableTasks.map(task => {
                    const formattedStatus = formatTaskStatusLabel(task.status)

                    return (
                      <CommandItem
                        key={task.id}
                        value={`${task.title} ${task.id}`}
                        onSelect={() => {
                          onAddTask(task.id)
                          onTaskPickerOpenChange(false)
                        }}
                      >
                        <div className='flex flex-col'>
                          <span className='font-medium'>{task.title}</span>
                          {formattedStatus ? (
                            <span className='text-muted-foreground text-xs'>
                              {formattedStatus}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className='text-muted-foreground text-xs'>
          Leave empty to apply hours to the project only.
        </p>
        <div className='space-y-2'>
          {selectedTasks.length === 0
            ? null
            : selectedTasks.map(task => {
                const formattedStatus = formatTaskStatusLabel(task.status)

                return (
                  <div
                    key={task.id}
                    className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
                  >
                    <div className='flex flex-col text-sm leading-tight'>
                      <span className='font-medium'>{task.title}</span>
                      {formattedStatus ? (
                        <span className='text-muted-foreground text-xs'>
                          {formattedStatus}
                        </span>
                      ) : null}
                    </div>
                    <DisabledFieldTooltip
                      disabled={isMutating}
                      reason={isMutating ? 'Logging time...' : null}
                    >
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='text-muted-foreground hover:text-destructive'
                        onClick={() => requestTaskRemoval(task)}
                        disabled={isMutating}
                        aria-label={`Remove ${task.title}`}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </DisabledFieldTooltip>
                  </div>
                )
              })}
        </div>
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
        />
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
          disabled={disableCreate}
          reason={submitTooltipReason}
        >
          <Button
            type='submit'
            disabled={disableCreate}
            className='inline-flex items-center gap-2'
          >
            {isMutating ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <PlusCircle className='size-4' />
            )}
            Log time
          </Button>
        </DisabledFieldTooltip>
      </div>
    </form>
  )
}
