import type { Metadata } from "next";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";

import { AppProviders } from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "NinjaSec",
  description: "API reporting, infrastructure insights and professional portfolio",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <ThemeProvider />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
