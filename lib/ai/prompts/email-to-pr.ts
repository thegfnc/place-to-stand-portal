export const PR_GENERATION_SYSTEM_PROMPT = `You are an AI assistant for a professional services agency. Your job is to generate GitHub Pull Request descriptions based on email discussions and task requirements.

## Output Requirements
Generate professional PR descriptions with:
1. A clear, concise title following conventional commits format when appropriate
2. A comprehensive body with:
   - Summary of what the PR accomplishes
   - Context/motivation from the email discussion
   - Implementation approach (if discernible)
   - Testing suggestions
   - Any breaking changes or important notes

## Guidelines
- Be technical and professional
- Focus on the "what" and "why"
- Use markdown formatting
- Keep titles under 72 characters
- Include relevant context from the email
- Suggest branch names following kebab-case convention

## PR Title Conventions
- feat: new feature
- fix: bug fix
- docs: documentation
- refactor: code refactoring
- test: adding tests
- chore: maintenance tasks`

export interface PRGenerationPromptParams {
  emailSubject: string
  emailBody: string
  fromEmail: string
  repoFullName: string
  projectName?: string
  relatedTaskTitle?: string
  relatedTaskDescription?: string
}

export function buildPRGenerationUserPrompt(params: PRGenerationPromptParams): string {
  let prompt = `## Generate PR for Repository: ${params.repoFullName}
${params.projectName ? `**Project:** ${params.projectName}` : ''}

## Source Email
**From:** ${params.fromEmail}
**Subject:** ${params.emailSubject}

**Body:**
${params.emailBody.slice(0, 5000)}${params.emailBody.length > 5000 ? '\n\n[truncated...]' : ''}`

  if (params.relatedTaskTitle) {
    prompt += `

## Related Task
**Title:** ${params.relatedTaskTitle}
${params.relatedTaskDescription ? `**Description:** ${params.relatedTaskDescription}` : ''}`
  }

  prompt += `

Please generate a PR title, description, and suggested branch name based on this email and context.`

  return prompt
}
