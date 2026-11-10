import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OriensCI — Chatbot d'orientation académique et professionnelle",
  description:
    "Assistant intelligent d'aide à l'orientation pour les élèves et étudiants ivoiriens. Profil, test RIASEC, recommandations personnalisées et conseiller humain.",
  keywords: [
    "orientation", "Côte d'Ivoire", "RIASEC", "Holland", "filière", "métier",
    "chatbot", "étudiant", "Terminale", "Licence",
  ],
  authors: [{ name: "OriensCI" }],
  icons: {
    icon: "/oriensci-avatar.png",
  },
  openGraph: {
    title: "OriensCI — Orientation académique et professionnelle",
    description: "Chatbot d'orientation pour les étudiants ivoiriens, basé sur le modèle RIASEC.",
    siteName: "OriensCI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
