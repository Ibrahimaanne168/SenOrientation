import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://jangora.sn"),
  title: "Jangora — Guide d'orientation scolaire & universitaire au Sénégal",
  description:
    "Trouve ta filière après le Bac au Sénégal : universités publiques, Campusen, bourses et grandes écoles avec Jangora.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "fr_SN",
    url: "https://jangora.sn",
    siteName: "Jangora",
    title: "Jangora — Orientation scolaire & universitaire au Sénégal",
    description:
      "Trouve ta filière après le Bac au Sénégal : universités publiques, Campusen, bourses et grandes écoles avec Jangora.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Jangora — Emblème officiel Baobab & Orientation Sénégal",
      },
      {
        url: "/emblem-rounded.png",
        width: 512,
        height: 512,
        alt: "Jangora — Emblème arrondi",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Jangora — Orientation scolaire & universitaire au Sénégal",
    description:
      "Trouve ta filière après le Bac au Sénégal : universités publiques, Campusen, bourses et grandes écoles avec Jangora.",
    images: ["/icon.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jangora",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0D2928",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`h-full dark ${sourceSerif.variable} ${inter.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('theme');
                if (saved === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {
                document.documentElement.classList.add('dark');
              }
              if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              name: "Jangora",
              alternateName: "SenOrientation",
              url: "https://jangora.sn",
              logo: "https://jangora.sn/icon.png",
              image: "https://jangora.sn/icon.png",
              description:
                "Plateforme intelligente d'orientation académique et universitaire pour les bacheliers et étudiants au Sénégal.",
              sameAs: [],
            }),
          }}
        />
      </head>
      <body className="h-full bg-[var(--bg-app)] text-[var(--text-main)] font-sans antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
