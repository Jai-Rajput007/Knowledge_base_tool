import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { LimelightNav } from "./components/limelight-nav";
import { AuthGuard } from "./components/auth-guard";
import { HeaderActions } from "./components/header-actions";
import { Sidebar } from "./components/sidebar";
import { ShiftingDropDown } from "./components/shifting-dropdown";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "G1 RAG Dashboard",
  description: "Robot Knowledge Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get('g1_session')?.value;
  
  let isLoggedIn = false;
  let role = null;
  
  if (token) {
    const session = await verifyToken(token);
    if (session) {
      isLoggedIn = true;
      role = session.role;
    }
  }

  // Hide the RAG Navigation UI for super admins (they have their own dashboard layout)
  // and for logged-out visitors (they see the clean landing page)
  const showRagUi = isLoggedIn && role !== 'SUPER_ADMIN';

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-background text-foreground">
        <ThemeProvider>
          {showRagUi && <Sidebar />}
          
          <div className={`flex flex-col flex-1 relative min-h-screen max-w-full overflow-hidden ${showRagUi ? 'pl-[60px]' : ''}`}>
            {showRagUi && <LimelightNav />}
            <HeaderActions isLoggedIn={isLoggedIn} />
            
            <main className="flex-1 p-6 pt-32 overflow-y-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
