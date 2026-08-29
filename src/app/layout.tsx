import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almacenator 2.0",
  description: "Sistema de acceso para Almacenator 2.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
