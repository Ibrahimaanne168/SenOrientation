import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SenOrientation — Agent IA d'Orientation",
  description:
    "Orientation scolaire et universitaire personnalisée pour les élèves et étudiants sénégalais : universités, filières, admissions Campusen et bourses.",
  keywords: [
    "Orientation Sénégal",
    "Campusen",
    "UCAD",
    "UGB",
    "Bourses Sénégal",
    "Filières Bac S1 S2 L1 L2 G",
  ],
  authors: [{ name: "SenOrientation" }],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`h-full ${fraunces.variable} ${inter.variable}`}
    >
      <body
        className="h-full antialiased bg-[#FAFAFA] text-gray-900"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
