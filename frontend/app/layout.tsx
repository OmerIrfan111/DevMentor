import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevMentor Band — AI Senior Dev Team",
  description: "Get architectural feedback, onboarding docs, and Socratic mentorship from a band of AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
