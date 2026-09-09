"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "./cn"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <PopoverPrimitive.Trigger
        data-slot="popover-trigger"
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return (
    <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  )
}

/**
 * Aliases the Radix CSS variables consumers still reference (trigger width,
 * available height, transform origin) onto Base UI's Positioner-provided vars
 * so existing class strings and inline styles keep working unchanged.
 */
const radixVarAliases = {
  "--radix-popover-trigger-width": "var(--anchor-width)",
  "--radix-popover-content-available-height": "var(--available-height)",
  "--radix-popover-content-transform-origin": "var(--transform-origin)",
} as React.CSSProperties

function PopoverContent({
  className,
  // House rule: dropdown popups left-align with their trigger; deviations
  // opt in with an explicit `align` at the call site.
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  style,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <StickySidePositioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          style={{ ...radixVarAliases, ...style }}
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
            className
          )}
          {...props}
        />
      </StickySidePositioner>
    </PopoverPrimitive.Portal>
  )
}

type PositionerSide = NonNullable<PopoverPrimitive.Positioner.Props["side"]>

/**
 * Pins the popup to whichever side it first resolved to. floating-ui re-runs
 * collision avoidance on every content resize, so a filterable list that had
 * to open upward (no room below for the full list) jumps beneath the trigger
 * the moment the results shrink enough to fit. Once the first placement is
 * known it is locked for the rest of this open; the positioner unmounts with
 * the portal on close, which resets the lock.
 */
function StickySidePositioner({
  side,
  children,
  ...props
}: PopoverPrimitive.Positioner.Props) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [lockedSide, setLockedSide] = React.useState<PositionerSide | null>(
    null
  )

  React.useEffect(() => {
    if (lockedSide) return
    // The first paint carries the preferred side; floating-ui resolves the
    // real placement a microtask later, so read it after the next frame.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const resolved = ref.current?.dataset.side as PositionerSide | undefined
        if (resolved) setLockedSide(resolved)
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [lockedSide])

  return (
    <PopoverPrimitive.Positioner
      ref={ref}
      side={lockedSide ?? side}
      collisionAvoidance={lockedSide ? { side: "none" } : undefined}
      className="pointer-events-auto isolate z-50"
      {...props}
    >
      {children}
    </PopoverPrimitive.Positioner>
  )
}

/**
 * Base UI has no Anchor part; anchoring is configured on the Positioner.
 * This export is kept only to preserve the module's public API (it has no
 * consumers in the app) and renders a plain element.
 */
function PopoverAnchor({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
