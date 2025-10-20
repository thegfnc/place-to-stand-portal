type ToastVariant = "default" | "destructive";

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();

const DEFAULT_DURATION = 4000;

export type ToastOptions = {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

export type ToastMessage = Required<Pick<ToastOptions, "title">> &
  Omit<ToastOptions, "id"> & {
    id: string;
  };

export function toast(options: ToastOptions): string {
  const id = options.id ?? generateId();
  const toastMessage: ToastMessage = {
    variant: "default",
    duration: DEFAULT_DURATION,
    description: options.description,
    title: options.title,
    id,
  };

  if (options.variant) {
    toastMessage.variant = options.variant;
  }

  if (typeof options.duration === "number") {
    toastMessage.duration = options.duration;
  }

  listeners.forEach((listener) => listener(toastMessage));

  return id;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}
