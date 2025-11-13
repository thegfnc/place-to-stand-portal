'use client';

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import { ReactQueryProvider } from "./react-query-provider";
import { PostHogProvider } from "./posthog-provider";
import { ThemeProvider } from "./theme-provider";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <PostHogProvider>
      <ThemeProvider>
        <ReactQueryProvider>
          {children}
          <Toaster />
        </ReactQueryProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
