import type { Metadata, Viewport } from "next";
import theme from "../pwa-theme.json";
import { appearanceBootstrap } from "./appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarili",
  description: "Aarili boutique management",
};
export const viewport: Viewport = { themeColor: theme.primary };
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fixed first-party preference script runs before paint; no user input. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap with no untrusted interpolation */}
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
