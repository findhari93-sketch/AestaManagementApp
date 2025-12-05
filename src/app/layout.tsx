import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteProvider } from "@/contexts/SiteContext";

export const metadata: Metadata = {
  title: "Aesta Construction Manager",
  description: "Construction Labor Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SiteProvider>
              {children}
            </SiteProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
