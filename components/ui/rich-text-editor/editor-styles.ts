let editorStylesElement: HTMLStyleElement | null = null

export const ensureEditorStyles = () => {
  if (typeof document === 'undefined') {
    return
  }

  if (!editorStylesElement) {
    editorStylesElement = document.createElement('style')
    editorStylesElement.setAttribute('data-rich-text-editor-styles', 'true')
    document.head.appendChild(editorStylesElement)
  }

  const styles = `
    /* Ensure text selection works in the editor */
    .rich-text-editor .tiptap.ProseMirror {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }

    .rich-text-editor .tiptap.ProseMirror * {
      user-select: text !important;
      -webkit-user-select: text !important;
    }

    .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: var(--muted-foreground);
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
      user-select: none !important;
      font-size: inherit;
    }

    .rich-text-editor .ProseMirror ul,
    .rich-text-editor .ProseMirror ol {
      padding-left: 1.25rem;
      margin: 0.5rem 0;
    }

    .rich-text-editor .ProseMirror li {
      margin: 0.25rem 0;
    }

    /* Ensure first child elements (lists, paragraphs, etc.) have consistent font size */
    .rich-text-editor .ProseMirror > *:first-child {
      font-size: 1rem !important;
    }

    .rich-text-editor .ProseMirror > ul:first-child,
    .rich-text-editor .ProseMirror > ol:first-child {
      font-size: 1rem !important;
    }

    .rich-text-editor .ProseMirror > ul:first-child li,
    .rich-text-editor .ProseMirror > ol:first-child li {
      font-size: 1rem !important;
    }

    .rich-text-editor .ProseMirror p {
      margin: 0.5rem 0;
      font-size: 1rem !important;
      line-height: 1.6 !important;
      font-weight: normal;
    }

    /* Ensure first paragraph has same font size as others */
    .rich-text-editor .ProseMirror p:first-child {
      font-size: 1rem !important;
      line-height: 1.6 !important;
      font-weight: normal;
    }

    .rich-text-editor .ProseMirror:focus {
      outline: none;
    }
  `

  editorStylesElement.textContent = styles

  // Add required TipTap CSS variables if they don't exist
  if (typeof document !== 'undefined') {
    const root = document.documentElement

    // Set TipTap CSS variables with fallbacks
    root.style.setProperty('--white', '#ffffff')
    root.style.setProperty('--black', '#000000')
    root.style.setProperty(
      '--tt-dropdown-menu-bg-color',
      'var(--background, #ffffff)'
    )
    root.style.setProperty(
      '--tt-dropdown-menu-border-color',
      'var(--border, #e5e5e5)'
    )
    root.style.setProperty(
      '--tt-dropdown-menu-text-color',
      'var(--foreground, #000000)'
    )
    root.style.setProperty(
      '--tiptap-card-bg-color',
      'var(--background, #ffffff)'
    )
    root.style.setProperty(
      '--tiptap-card-border-color',
      'var(--border, #e5e5e5)'
    )
  }
}
