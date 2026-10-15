import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarili workspace",
  description: "Synthetic development scaffold",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  const trial =
    process.env.NODE_ENV === "development" &&
    process.env.AARILI_DESIGN_TRIAL === "grounded-editorial";
  return (
    <html
      lang="en"
      data-aarili-theme={trial ? "grounded-editorial" : undefined}
    >
      <body>{children}</body>
    </html>
  );
}
