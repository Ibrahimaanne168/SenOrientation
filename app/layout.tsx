import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent IA d'Orientation | Sénégal",
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
  authors: [{ name: "Ministère / Projet Orientation Sénégal" }],
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
    <html lang="fr" className="h-full">
      <body className="h-full antialiased bg-white text-[#172033] selection:bg-[#1677E8]/20 selection:text-[#0B3B82]">
        {children}
      </body>
    </html>
  );
}
