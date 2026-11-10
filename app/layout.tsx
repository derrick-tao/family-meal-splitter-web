import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg` },
  title: "Family Meal Splitter · A fair share for every appetite",
  description:
    "Split a restaurant bill fairly between households, adjust little eaters’ portions, and copy a friendly group message. Private, free, and no account needed.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#177769",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
