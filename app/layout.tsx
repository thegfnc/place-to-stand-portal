import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { SupabaseListener } from "@/components/providers/supabase-listener";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Place to Stand Portal",
  description: "Client and project management for the Place to Stand collective.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const initialSession = session
    ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }
    : null;

  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <AppProviders>
          <SupabaseListener initialSession={initialSession} />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
