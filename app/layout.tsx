import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";
import { AuthListener } from "@/components/providers/AuthListener";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sterling EventOps | Event Logistics & Asset Control",
  description:
    "Enterprise event rental inventory tracking, scanning, and logistics management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", plusJakartaSans.variable, plusJakartaSans.className)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthListener>{children}</AuthListener>
      </body>
    </html>
  );
}
