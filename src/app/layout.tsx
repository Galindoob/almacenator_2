import type { Metadata } from "next";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { SyncProvider } from "./components/SyncProvider";
import { AppDialogProvider } from "./components/AppDialogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniGest",
  description: "Sistema de acceso para MiniGest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SyncProvider><AppearanceProvider><AppDialogProvider>{children}</AppDialogProvider></AppearanceProvider></SyncProvider>
      </body>
    </html>
  );
}
