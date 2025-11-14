import type { Node as TiptapNode } from "@tiptap/pm/model"
import type { Transaction } from "@tiptap/pm/state"
import type { NodeWithPos } from "@tiptap/react"
import type { Editor } from "@tiptap/react"

import { isValidPosition } from "./selection"

/**
 * Finds a node at the specified position with error handling
 * @param editor The Tiptap editor instance
 * @param position The position in the document to find the node
 * @returns The node at the specified position, or null if not found
 */
export function findNodeAtPosition(editor: Editor, position: number) {
  try {
    const node = editor.state.doc.nodeAt(position)
    if (!node) {
      console.warn(`No node found at position ${position}`)
      return null
    }
    return node
  } catch (error) {
    console.error(`Error getting node at position ${position}:`, error)
    return null
  }
}

/**
 * Finds the position and instance of a node in the document
 * @param props Object containing editor, node (optional), and nodePos (optional)
 * @param props.editor The Tiptap editor instance
 * @param props.node The node to find (optional if nodePos is provided)
 * @param props.nodePos The position of the node to find (optional if node is provided)
 * @returns An object with the position and node, or null if not found
 */
export function findNodePosition(props: {
  editor: Editor | null
  node?: TiptapNode | null
  nodePos?: number | null
}): { pos: number; node: TiptapNode } | null {
  const { editor, node, nodePos } = props

  if (!editor || !editor.state?.doc) return null

  // Zero is valid position
  const hasValidNode = node !== undefined && node !== null
  const hasValidPos = isValidPosition(nodePos)

  if (!hasValidNode && !hasValidPos) {
    return null
  }

  // First search for the node in the document if we have a node
  if (hasValidNode) {
    let foundPos = -1
    let foundNode: TiptapNode | null = null

    editor.state.doc.descendants((currentNode, pos) => {
      if (currentNode === node) {
        foundPos = pos
        foundNode = currentNode
        return false
      }
      return true
    })

    if (foundPos !== -1 && foundNode !== null) {
      return { pos: foundPos, node: foundNode }
    }
  }

  // If we have a valid position, use findNodeAtPosition
  if (hasValidPos) {
    const nodeAtPos = findNodeAtPosition(editor, nodePos!)
    if (nodeAtPos) {
      return { pos: nodePos!, node: nodeAtPos }
    }
  }

  return null
}

/**
 * Update a single attribute on multiple nodes.
 *
 * @param tr - The transaction to mutate
 * @param targets - Array of { node, pos }
 * @param attrName - Attribute key to update
 * @param next - New value OR updater function receiving previous value
 *               Pass `undefined` to remove the attribute.
 * @returns true if at least one node was updated, false otherwise
 */
export function updateNodesAttr<A extends string = string, V = unknown>(
  tr: Transaction,
  targets: readonly NodeWithPos[],
  attrName: A,
  next: V | ((prev: V | undefined) => V | undefined)
): boolean {
  if (!targets.length) return false

  let changed = false

  for (const { pos } of targets) {
    // Always re-read from the transaction's current doc
    const currentNode = tr.doc.nodeAt(pos)
    if (!currentNode) continue

    const prevValue = (currentNode.attrs as Record<string, unknown>)[
      attrName
    ] as V | undefined
    const resolvedNext =
      typeof next === "function"
        ? (next as (p: V | undefined) => V | undefined)(prevValue)
        : next

    if (prevValue === resolvedNext) continue

    const nextAttrs: Record<string, unknown> = { ...currentNode.attrs }
    if (resolvedNext === undefined) {
      // Remove the key entirely instead of setting null
      delete nextAttrs[attrName]
    } else {
      nextAttrs[attrName] = resolvedNext
    }

    tr.setNodeMarkup(pos, undefined, nextAttrs)
    changed = true
  }

  return changed
}

