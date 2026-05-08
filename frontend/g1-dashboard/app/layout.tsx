import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { LimelightNav } from "./components/limelight-nav";
import { AuthGuard } from "./components/auth-guard";
import { HeaderActions } from "./components/header-actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "G1 RAG Dashboard",
  description: "Robot Knowledge Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <div className="flex flex-col min-h-full">
            <LimelightNav />
            <HeaderActions />
            <AuthGuard>
              <main className="flex-1 pt-28">{children}</main>
            </AuthGuard>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
