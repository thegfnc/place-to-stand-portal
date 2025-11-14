"use client"

import { useMemo } from "react"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

export function useProjectsBoardSensors() {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  return useMemo(() => ({ sensors }), [sensors])
}

