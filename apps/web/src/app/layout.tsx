import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
import { RouteGuard } from "../components/RouteGuard";

export const metadata: Metadata = {
  title: "Traceback — Code Rationale Verification",
  description: "Verify the evidence behind AI-generated code explanations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash script to guarantee light mode default and restore saved preference before render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('traceback-theme-preference');
                if (stored === 'dark') {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'light');
              }
            `,
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <RouteGuard>{children}</RouteGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
