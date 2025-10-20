'use client';

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import { ReactQueryProvider } from "./react-query-provider";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <ReactQueryProvider>
      {children}
      <Toaster />
    </ReactQueryProvider>
  );
}
