import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const siteUrl = "https://potatofocus.app";
const siteTitle = "potatofocus — minimal pomodoro timer";
const siteDescription =
  "A minimal, no-login pomodoro timer with ambient focus sounds, daily progress, country-aware profiles, and a global leaderboard.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "potatofocus",
  title: {
    default: siteTitle,
    template: "%s | potatofocus",
  },
  description: siteDescription,
  keywords: [
    "potatofocus",
    "pomodoro timer",
    "focus timer",
    "study timer",
    "ambient focus music",
    "global pomodoro leaderboard",
  ],
  authors: [{ name: "potatofocus" }],
  creator: "potatofocus",
  publisher: "potatofocus",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "potatofocus",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="cream" className={GeistMono.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.21.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
