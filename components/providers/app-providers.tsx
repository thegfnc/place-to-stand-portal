'use client';

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import { ReactQueryProvider } from "./react-query-provider";
import { ThemeProvider } from "./theme-provider";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider>
      <ReactQueryProvider>
        {children}
        <Toaster />
      </ReactQueryProvider>
    </ThemeProvider>
  );
}
