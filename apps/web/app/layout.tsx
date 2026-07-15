import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cordova Coach AI",
  description: "Workout-image nutrition and recovery coach"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
