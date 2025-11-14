"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { SummaryState } from "./use-recent-activity-summary"

type SummaryContentProps = {
  state: SummaryState
}

export function SummaryContent({ state }: SummaryContentProps) {
  if (state.status === "error") {
    return (
      <div className="text-destructive text-sm">
        {state.error ?? "We were unable to load the recent activity overview."}
      </div>
    )
  }

  if (
    state.status === "loading" ||
    (state.status === "streaming" && !state.text)
  ) {
    return <LoadingState />
  }

  if (!state.text.trim()) {
    return (
      <div className="text-muted-foreground text-sm">
        No updates to share just yet. As soon as activity is captured, you’ll see
        a recap here.
      </div>
    )
  }

  return (
    <div className="prose prose-sm text-foreground dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ul: (props) => (
            <ul {...props} className="mt-2 list-disc pl-4 text-sm leading-6" />
          ),
          ol: (props) => (
            <ol
              {...props}
              className="mt-2 list-decimal pl-4 text-sm leading-6"
            />
          ),
          p: (props) => <p {...props} className="text-sm leading-6" />,
          h3: (props) => (
            <h3
              {...props}
              className="text-foreground text-xs font-semibold tracking-wide uppercase not-first:mt-3"
            />
          ),
          strong: (props) => (
            <strong {...props} className="text-foreground font-semibold" />
          ),
        }}
      >
        {state.text}
      </ReactMarkdown>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="bg-muted h-3 w-4/5 animate-pulse rounded-full" />
      <div className="bg-muted h-3 w-full animate-pulse rounded-full" />
      <div className="bg-muted h-3 w-11/12 animate-pulse rounded-full" />
      <div className="bg-muted h-3 w-10/12 animate-pulse rounded-full" />
    </div>
  )
}

