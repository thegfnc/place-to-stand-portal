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

  editorStylesElement.textContent = `
    .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: var(--muted-foreground);
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    .rich-text-editor .ProseMirror ul,
    .rich-text-editor .ProseMirror ol {
      padding-left: 1.25rem;
      margin: 0.5rem 0;
    }

    .rich-text-editor .ProseMirror li {
      margin: 0.25rem 0;
    }

    .rich-text-editor .ProseMirror p {
      margin: 0.5rem 0;
    }

    .rich-text-editor .ProseMirror:focus {
      outline: none;
    }
  `
}
