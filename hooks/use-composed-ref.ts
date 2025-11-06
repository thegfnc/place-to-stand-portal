"use client"

import { useCallback, useEffect, useRef } from "react"

// basically Exclude<React.ClassAttributes<T>["ref"], string>
type UserRef<T> =
  | ((instance: T | null) => void)
  | React.RefObject<T | null>
  | null
  | undefined

const updateRef = <T>(ref: NonNullable<UserRef<T>>, value: T | null) => {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref && typeof ref === "object" && "current" in ref) {
    // Safe assignment without MutableRefObject
    ;(ref as { current: T | null }).current = value
  }
}

export const useComposedRef = <T extends HTMLElement>(
  libRef: React.RefObject<T | null>,
  userRef: UserRef<T>
) => {
  const prevUserRef = useRef<UserRef<T>>(null)
  const libRefRef = useRef(libRef)
  const userRefRef = useRef(userRef)

  // Keep refs in sync with latest values
  useEffect(() => {
    libRefRef.current = libRef
    userRefRef.current = userRef
  }, [libRef, userRef])

  return useCallback(
    (instance: T | null) => {
      if (libRefRef.current && "current" in libRefRef.current) {
        ;(libRefRef.current as { current: T | null }).current = instance
      }

      if (prevUserRef.current) {
        updateRef(prevUserRef.current, null)
      }

      prevUserRef.current = userRefRef.current

      if (userRefRef.current) {
        updateRef(userRefRef.current, instance)
      }
    },
    []
  )
}

export default useComposedRef
