# Design System: Object Identity

This document outlines the color system used to distinguish different object types within the Place to Stand Portal and provides guidelines for extending this system.

## Color Coding

Each primary object type is assigned a distinct color from the Tailwind CSS palette. This color is used to provide immediate visual recognition across the application, particularly in card views and lists.

| Object Type | Color Name | Tailwind Class Prefix | Hex (500) |
| :--- | :--- | :--- | :--- |
| **Task** | Violet | `violet` | `#8b5cf6` |
| **Lead** | Amber | `amber` | `#f59e0b` |
| **Project** | Emerald | `emerald` | `#10b981` |
| **Client** | Blue | `blue` | `#3b82f6` |
| **Contact** | Cyan | `cyan` | `#06b6d4` |
| **Suggestion** | Fuchsia | `fuchsia` | `#d946ef` |
| **Invoice** | Orange | `orange` | `#f97316` |
| **Hour Block** | Teal | `teal` | `#14b8a6` |
| **User** | Rose | `rose` | `#f43f5e` |
| **Submission** | Pink | `pink` | `#ec4899` |

The canonical class strings live in `lib/entity-accents.ts` (`ENTITY_ACCENTS`), which exports the card pattern, static-card pattern, and sheet-header accent per entity. Consume that module rather than re-typing the classes.

## Visual Application

The color identity is primarily applied to **Cards** using the following pattern:

1.  **Border:** A uniform 1px border in a semi-transparent shade of the object's primary color (`-500/35`). The border is symmetric on all sides so the card geometry stays centered — do **not** use a thick colored left border (`border-l-4`), a widely-disliked style that also shifts card content off-center.
2.  **Hover State:**
    *   **Border:** The border strengthens to `/60`.
    *   **Background:** A very subtle tint (`/5`) of the color appears on hover.
3.  **Icons:** In some contexts (like headers or lists), the object's icon may be colored with the `-500` shade.

### Standard Class Pattern

Apply these utility classes to the main container (e.g., `Card` or `div`):

```tsx
className={cn(
  // Base layout and border
  'border shadow-sm transition-all',

  // 1. Identity Color (tinted border)
  'border-[COLOR]-500/35',

  // 2. Hover States
  'hover:border-[COLOR]-500/60',
  'hover:bg-[COLOR]-500/5',
  'hover:shadow-md'
)}
```

## Extension Guide

When adding a new object type (e.g., "Invoice", "Ticket", "Note"), follow these steps to maintain consistency:

### 1. Choose a Distinct Color
Select a color from the Tailwind palette that is visually distinct from the existing set.
*   *Avoid:* Violet, Amber, Emerald, Blue, Cyan, Fuchsia, Orange, Teal, Rose, Pink.
*   *Suggested:*
    *   **Slate** (`slate-500`) for neutral or archived items.

### 2. Apply the Pattern
Add the entity to `ENTITY_ACCENTS` in `lib/entity-accents.ts` with the standard class pattern (written out literally so Tailwind's scanner picks the classes up), then consume it from there.

**Example: Creating an `InvoiceCard` (using Orange)**

```tsx
import { cn } from '@/lib/utils'

export function InvoiceCard({ invoice }) {
  return (
    <div
      className={cn(
        'group bg-card rounded-lg p-4 text-left shadow-sm transition',
        // Base border
        'border',

        // Identity: Orange
        'border-orange-500/35',

        // Hover States
        'hover:border-orange-500/60',
        'hover:bg-orange-500/5',
        'hover:shadow-md'
      )}
    >
      <h3 className="font-semibold">Invoice #{invoice.id}</h3>
      {/* ... content ... */}
    </div>
  )
}
```

### 3. Consistent Link Hover
Ensure any links inside the card match the standard interaction style:
```tsx
<Link
  href={...}
  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
>
  View Details
</Link>
```

## Table Column Widths

Every list table renders `<Table density='compact' layout='fixed'>`. Under `table-layout: fixed` the header row alone decides column widths, so the header must describe every column deliberately. The rule that keeps tables proportional at any viewport:

1. **Content-sized columns get a fixed `rem` width, never a percentage.** Badges, toggles, icon-plus-count cells, dates, avatars, currency or hour figures, and the Actions column. Size to the widest realistic content plus cell padding: a lone badge `w-20`–`w-24`, a toggle with its label `w-28`, an icon-plus-count `w-16`–`w-20`, a short date `w-28`, two icon buttons `w-24`, three `w-32`. A percentage on a narrow column scales with the viewport instead of its content and is what leaves empty air beside a single icon on small screens.
2. **Text columns get no width class at all.** Names, emails, titles, notes. Columns without a declared width split the leftover space equally, so they absorb whatever the viewport gives and truncate. If one text column should dominate, give only that one a percentage (`w-[40%]`); never more than one percentage column per table. Every text cell keeps `truncate` (and `min-w-0` when the cell wraps a flex row).
3. **Hide secondary columns below `md`.** Put `hidden md:table-cell` on the `TableHead` *and* on every `TableCell` of that column. Candidates: created/joined dates, a secondary identifier when the identity column already shows the name (email, phone), origination/closer, share links. Never hide the identity column or Actions. Empty-state rows keep `colSpan` at the full column count; browsers clamp it when columns are hidden.

`components/ui/pagination-controls.tsx` and `packages/ui/src/table.tsx` carry the matching comments; `app/(dashboard)/settings/users/_components/users-table-section.tsx` is the reference table.
