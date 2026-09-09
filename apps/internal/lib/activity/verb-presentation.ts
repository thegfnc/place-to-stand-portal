import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  GitBranch,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icon + colour tone for each activity verb family. Tone is only ever a
 * secondary cue — the summary sentence carries the meaning — so a verb that
 * misses this table still renders fine with the neutral fallback.
 */
export type ActivityTone =
  | 'create'
  | 'update'
  | 'status'
  | 'archive'
  | 'delete'
  | 'comment'
  | 'time'
  | 'money'
  | 'view'
  | 'integration'
  | 'neutral'

export type VerbPresentation = {
  icon: LucideIcon
  tone: ActivityTone
}

const TONE_CLASSES: Record<ActivityTone, string> = {
  create:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  update: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  status:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  archive:
    'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  comment:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  time: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  money:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  view: 'bg-muted text-muted-foreground',
  integration:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  neutral: 'bg-muted text-muted-foreground',
}

export function getToneClasses(tone: ActivityTone): string {
  return TONE_CLASSES[tone]
}

const EXACT: Record<string, VerbPresentation> = {
  TASK_STATUS_CHANGED: { icon: ArrowRightLeft, tone: 'status' },
  LEAD_STATUS_CHANGED: { icon: ArrowRightLeft, tone: 'status' },
  TASK_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  TASKS_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  TASK_ACCEPTANCE_REVERTED: { icon: RotateCcw, tone: 'status' },
  TIME_LOG_CREATED: { icon: Clock, tone: 'time' },
  INVOICE_SENT: { icon: Send, tone: 'money' },
  INVOICE_PAID: { icon: DollarSign, tone: 'money' },
  INVOICE_VOIDED: { icon: XCircle, tone: 'delete' },
  INVOICE_UNSENT: { icon: RotateCcw, tone: 'status' },
  PROPOSAL_SENT: { icon: Send, tone: 'update' },
  PROPOSAL_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  PROPOSAL_COUNTERSIGNED: { icon: CheckCircle2, tone: 'create' },
  PROPOSAL_REJECTED: { icon: XCircle, tone: 'delete' },
  CONTACT_INVITED_TO_PORTAL: { icon: UserPlus, tone: 'create' },
  USER_CREATED: { icon: UserPlus, tone: 'create' },
  LEAD_CONVERTED: { icon: Sparkles, tone: 'create' },
  LEAD_UPDATE_LOGGED: { icon: MessageSquare, tone: 'comment' },
  TASK_CREATED_FROM_EMAIL: { icon: Mail, tone: 'create' },
  OAUTH_CONNECTED: { icon: Lock, tone: 'integration' },
  OAUTH_DISCONNECTED: { icon: Lock, tone: 'archive' },
  OAUTH_REFRESHED: { icon: Lock, tone: 'integration' },
  OAUTH_EXPIRED: { icon: Lock, tone: 'delete' },
  MONTHLY_CLOSE_CLOSED: { icon: Lock, tone: 'money' },
  MONTHLY_CLOSE_REOPENED: { icon: RotateCcw, tone: 'status' },
  GITHUB_PR_CREATED: { icon: GitBranch, tone: 'integration' },
  PR_CREATED_FROM_SUGGESTION: { icon: GitBranch, tone: 'integration' },
}

const FALLBACK: VerbPresentation = { icon: FileText, tone: 'neutral' }

export function getVerbPresentation(verb: string): VerbPresentation {
  const exact = EXACT[verb]
  if (exact) return exact

  if (verb.endsWith('_VIEWED')) return { icon: Eye, tone: 'view' }
  if (verb.endsWith('_DELETED') || verb.endsWith('_DESTROYED')) {
    return { icon: Trash2, tone: 'delete' }
  }
  if (verb.endsWith('_ARCHIVED') || verb.endsWith('_UNSHARED')) {
    return { icon: Archive, tone: 'archive' }
  }
  if (verb.endsWith('_RESTORED')) return { icon: RotateCcw, tone: 'status' }
  if (verb.includes('COMMENT')) return { icon: MessageSquare, tone: 'comment' }
  if (verb.includes('GITHUB') || verb.includes('INTEGRATION')) {
    return { icon: Link2, tone: 'integration' }
  }
  if (verb.includes('WORKER') || verb.includes('SUGGESTION')) {
    return { icon: Sparkles, tone: 'integration' }
  }
  if (verb.endsWith('_CREATED') || verb.endsWith('_SHARED')) {
    return { icon: Plus, tone: 'create' }
  }
  if (verb.endsWith('_UPDATED') || verb.endsWith('_CHANGED')) {
    return { icon: Pencil, tone: 'update' }
  }

  return FALLBACK
}
