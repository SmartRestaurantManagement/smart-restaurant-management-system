import type { Metadata } from "next";
import localFont from "next/font/local";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Display/body pair for the Kaizen marketing pages (Home, Menu) only -
// scoped via CSS variables rather than replacing the app-wide Geist
// font-sans default used elsewhere (dashboard, cart, etc).
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});
const interMarketing = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kaizen — Smart Restaurant Platform",
  description:
    "Kaizen brings ordering, tables, and the kitchen into one live system - browse the menu, order and split the bill from your table, and track it in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geistSans.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${interMarketing.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
