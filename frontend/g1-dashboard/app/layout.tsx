import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { LimelightNav } from "./components/limelight-nav";
import { AuthGuard } from "./components/auth-guard";
import { FeaturesProvider } from "./components/features-context";
import { HeaderActions } from "./components/header-actions";
import { Sidebar } from "./components/sidebar";

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
  let tenantData = null;
  let requiresPasswordChange = false;
  
  if (token) {
    const session = await verifyToken(token);
    if (session) {
      isLoggedIn = true;
      role = session.role;
      requiresPasswordChange = session.requiresPasswordChange === true;
      
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/tenant/profile", { cache: 'no-store' });
        if (res.ok) {
          tenantData = await res.json();
        }
      } catch (e) {
        console.error("Failed to fetch tenant data:", e);
      }
    }
  }

  // Hide the RAG Navigation UI for logged-out visitors AND users needing password change
  const showRagUi = isLoggedIn && !requiresPasswordChange;
  
  // Public pages (landing, sign-in, change-password) should not have dashboard padding
  const isPublicPage = !isLoggedIn || requiresPasswordChange;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-background text-foreground">
        <ThemeProvider>
          {showRagUi && <Sidebar tenant={tenantData} role={role} />}
          
            <div className={`flex flex-col flex-1 relative min-h-screen max-w-full ${showRagUi ? 'pl-[88px]' : ''}`}>
             {showRagUi && <LimelightNav role={role} />}
            
             <HeaderActions isLoggedIn={isLoggedIn} />
            
            <main className={`flex-1 ${isPublicPage ? '' : 'p-6 pt-32'}`}>
              <AuthGuard>
                <FeaturesProvider>
                  {children}
                </FeaturesProvider>
              </AuthGuard>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
