/**
 * AI prompts for matching emails to clients
 */

export const EMAIL_TO_CLIENT_SYSTEM_PROMPT = `You are an AI assistant for a professional services agency. Your task is to analyze emails and determine which client(s) they are most likely related to.

You will be given:
1. Email metadata (from, to, cc, subject)
2. Email content/snippet
3. A list of clients with their known contacts and project names

Analyze the email and determine the best client match based on:
- Email addresses (exact matches with known contacts)
- Email domains (matching company domains)
- Email content mentioning client names, project names, or related keywords
- Contextual clues in the email body

Return your analysis with confidence scores (0.0 to 1.0):
- 1.0: Definite match (exact email match with known contact)
- 0.8-0.9: Very likely match (domain match or strong content signals)
- 0.6-0.7: Probable match (content mentions client/project)
- 0.4-0.5: Possible match (weak contextual signals)
- Below 0.4: Don't include as a suggestion

IMPORTANT: When returning matches, you MUST use the exact client ID (UUID) provided in the client list. Do NOT use the client name as the ID.

Only return clients you're reasonably confident about. It's better to return no suggestions than wrong ones.`

export interface EmailToClientPromptParams {
  email: {
    from: string | null
    to: string[]
    cc: string[]
    subject: string | null
    snippet: string | null
    bodyPreview?: string | null
  }
  clients: Array<{
    id: string
    name: string
    contacts: Array<{ email: string; name: string | null }>
    projects: Array<{ name: string }>
  }>
}

export function buildEmailToClientUserPrompt(params: EmailToClientPromptParams): string {
  const { email, clients } = params

  const emailSection = `## Email Details
- **From:** ${email.from || 'Unknown'}
- **To:** ${email.to.join(', ') || 'Unknown'}
- **CC:** ${email.cc.join(', ') || 'None'}
- **Subject:** ${email.subject || '(no subject)'}

### Email Content
${email.snippet || email.bodyPreview || '(no content available)'}`

  const clientsSection = `## Available Clients

${clients.map(client => `### ${client.name}
- **Client ID (use this exact UUID):** ${client.id}
- **Known Contacts:** ${client.contacts.length > 0 ? client.contacts.map(c => `${c.email}${c.name ? ` (${c.name})` : ''}`).join(', ') : 'None'}
- **Projects:** ${client.projects.length > 0 ? client.projects.map(p => p.name).join(', ') : 'None'}`).join('\n\n')}`

  return `${emailSection}

${clientsSection}

Analyze this email and identify which client(s) it is most likely related to. For each match, use the EXACT Client ID (UUID) shown above - do NOT use the client name as the ID. Provide your reasoning and confidence score for each match.`
}

