import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "חברותא — נפגשים יותר", description: "החברים, הזמן והמקום. כל מה שצריך כדי שבאמת ניפגש." };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
