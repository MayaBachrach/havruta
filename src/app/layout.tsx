import type { Metadata,Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = { title: "חברותא — נפגשים יותר", description: "החברים, הזמן והמקום. כל מה שצריך כדי שבאמת ניפגש." };

export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content',themeColor:[{media:'(prefers-color-scheme: light)',color:'#f5f7f6'},{media:'(prefers-color-scheme: dark)',color:'#151c19'}]};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
