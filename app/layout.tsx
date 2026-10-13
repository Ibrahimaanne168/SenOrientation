import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SenOrientation — Guide d'orientation post-Bac au Sénégal",
  description:
    "Trouve ta filière après le Bac au Sénégal : universités publiques, Campusen, bourses et grandes écoles.",
  icons: {
    icon: "/SenOrientation.png",
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
      className={`h-full ${inter.variable} ${sourceSerif.variable}`}
    >
      <body className="h-full bg-white text-[#172B46] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
