import { useCallback } from "react";

import { toast as dispatchToast, type ToastOptions } from "@/components/ui/toast";

export { type ToastOptions };

export function useToast() {
  const toast = useCallback((options: ToastOptions) => {
    dispatchToast(options);
  }, []);

  return { toast };
}

export const toast = dispatchToast;
