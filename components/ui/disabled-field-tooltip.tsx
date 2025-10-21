"use client";

import { cloneElement, type CSSProperties, type ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DisabledFieldTooltipProps = {
  disabled: boolean;
  reason?: string | null;
  children: ReactElement<{ className?: string; style?: CSSProperties }>;
};

export function DisabledFieldTooltip({ disabled, reason, children }: DisabledFieldTooltipProps) {
  if (!disabled || !reason) {
    return children;
  }

  const { className, style } = children.props;

  const wrappedChild = cloneElement(children, {
    className: cn(className, "pointer-events-none"),
    style: { ...style, pointerEvents: "none" },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed" aria-disabled="true">
          <span className="inline-flex w-full">{wrappedChild}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
