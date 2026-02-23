import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flight Dispatcher",
  description: "Airport departures → duration → open in SimBrief"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body>{children}</body>
    </html>
  );
}
