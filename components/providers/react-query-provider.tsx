'use client';

import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

type Props = {
  children: ReactNode;
};

export function ReactQueryProvider({ children }: Props) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Refetch stale queries when window regains focus (e.g., after computer sleep)
        refetchOnWindowFocus: true,
        // Refetch when reconnecting to the network
        refetchOnReconnect: true,
        // Consider data stale after 1 minute
        staleTime: 60 * 1000,
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
      },
    },
  }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
