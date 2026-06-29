import type { Metadata } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  // Roboto is non-variable here, so weights are explicit. 400/500/700 cover the
  // UI scale (semibold 600 → 700, extrabold 800 → 700, matching the old font).
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas | Nexorus",
  description: "Enterprise-grade strategic monitoring command center.",
  authors: [{ name: "Nexorus" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject attributes on <body> before React hydrates;
          this silences that false positive without masking real tree mismatches. */}
      <body className="min-h-screen text-foreground" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
