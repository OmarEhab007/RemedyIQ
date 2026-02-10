import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hasClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = {
  title: "RemedyIQ - AR Server Log Analysis",
  description: "Cloud SaaS log analysis platform for BMC Remedy AR Server",
};

function DevModeBanner() {
  if (hasClerkKey) return null;
  return (
    <div className="bg-amber-600 text-white text-center text-sm py-2 font-medium">
      DEV MODE — Authentication disabled
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DevModeBanner />
        {children}
      </body>
    </html>
  );

  if (hasClerkKey) {
    return <ClerkProvider>{app}</ClerkProvider>;
  }
  return app;
}
