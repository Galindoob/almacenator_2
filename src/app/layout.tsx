import type { Metadata } from "next";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { SyncProvider } from "./components/SyncProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini Gest",
  description: "Sistema de acceso para Mini Gest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SyncProvider><AppearanceProvider>{children}</AppearanceProvider></SyncProvider>
      </body>
    </html>
  );
}
