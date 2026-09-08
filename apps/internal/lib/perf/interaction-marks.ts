import type { InteractionEventName } from "@/lib/posthog/types";

export type InteractionMetadata = Record<string, unknown>;
export type InteractionProperties = Record<string, unknown>;

type InteractionEmitPayload = {
  name: InteractionEventName;
  metadata?: InteractionMetadata;
  properties?: InteractionProperties;
  duration?: number;
};

type InteractionOptions = {
  metadata?: InteractionMetadata;
  onEmit?: (payload: InteractionEmitPayload) => void;
};

export type InteractionHandle = {
  name: InteractionEventName;
  end: (properties?: InteractionProperties) => InteractionEmitPayload;
};

const performanceApi =
  typeof globalThis !== "undefined" && globalThis.performance
    ? globalThis.performance
    : undefined;

export function startInteraction(
  name: InteractionEventName,
  options?: InteractionOptions
): InteractionHandle {
  const markId = `${name}-start-${Date.now()}`;
  performanceApi?.mark(markId);

  return {
    name,
    end: (properties?: InteractionProperties) => {
      const endMarkId = `${name}-end-${Date.now()}`;
      const measureId = `${name}-duration-${Date.now()}`;

      performanceApi?.mark(endMarkId);
      performanceApi?.measure(measureId, markId, endMarkId);

      const measureEntry = performanceApi?.getEntriesByName(measureId).at(-1);
      const duration = measureEntry?.duration;

      performanceApi?.clearMarks(markId);
      performanceApi?.clearMarks(endMarkId);
      performanceApi?.clearMeasures(measureId);

      const payload: InteractionEmitPayload = {
        name,
        metadata: options?.metadata,
        properties,
        duration,
      };

      options?.onEmit?.(payload);

      return payload;
    },
  };
}
