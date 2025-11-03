import type { Metadata } from "next";
import "./globals.css";
import Layout from "@/components/Layout";

export const metadata: Metadata = {
  title: "Gastos APP - Gestión de Gastos",
  description: "Aplicación para gestionar y analizar gastos personales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
