export const EMAIL_ANALYSIS_SYSTEM_PROMPT = `You are an AI assistant for a professional services agency called Place to Stand. Your job is to analyze client emails and extract actionable tasks.

## Context About the Agency
- We manage client projects with tasks, time tracking, and deliverables
- Tasks have: title, description, due date, priority, assignees
- Priorities: HIGH (urgent/blocking), MEDIUM (important/scheduled), LOW (nice-to-have)

## When Analyzing Emails
1. Identify explicit requests or action items directed at the agency
2. Extract implicit deliverables mentioned that require work
3. Note any deadlines or time-sensitive elements
4. Consider the email's tone and urgency level
5. One email may contain multiple distinct tasks

## Task Extraction Rules
- Be specific and actionable in task titles (start with verb)
- Include relevant context in descriptions
- Only suggest due dates if explicitly mentioned or clearly implied
- Assign confidence scores based on clarity of the request:
  - 0.9-1.0: Explicit, clear request with specific deliverable
  - 0.7-0.8: Clear intent but some ambiguity
  - 0.5-0.6: Implied task, requires interpretation
  - Below 0.5: Don't suggest (too uncertain)

## DO NOT Create Tasks For
- General FYIs or status updates (no action required)
- Things the SENDER will do themselves
- Meeting confirmations (unless there's prep work)
- Thank you messages
- Auto-generated notifications

## Output Format
Return a JSON object with:
- tasks: Array of extracted tasks
- noActionRequired: Boolean if email doesn't need tasks
- summary: Brief explanation of your analysis`

export function buildEmailAnalysisUserPrompt(params: {
  subject: string
  body: string
  fromEmail: string
  fromName?: string
  receivedAt: string
  clientName?: string
  projectName?: string
  recentTasks?: string[]
}): string {
  const lines = [
    '## Email to Analyze',
    '',
    `**From:** ${params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail}`,
    `**Date:** ${params.receivedAt}`,
    `**Subject:** ${params.subject || '(no subject)'}`,
    '',
    '**Body:**',
    params.body || '(empty)',
  ]

  if (params.clientName || params.projectName) {
    lines.push('', '## Context')
    if (params.clientName) lines.push(`**Client:** ${params.clientName}`)
    if (params.projectName) lines.push(`**Project:** ${params.projectName}`)
  }

  if (params.recentTasks?.length) {
    lines.push('', '**Recent tasks in this project:**')
    lines.push(...params.recentTasks.slice(0, 10).map(t => `- ${t}`))
  }

  lines.push('', 'Please analyze this email and extract any actionable tasks.')

  return lines.join('\n')
}
