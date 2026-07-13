import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jason - JSON tools for builders",
  description: "Format, diff, patch, and inspect JSON in one focused workspace.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
