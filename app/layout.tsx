import type { Metadata, Viewport } from "next";
import "./globals.css";

// Display name only. The repository, the Vercel project, the database and
// package.json all remain "calorie-tracker" / "ai-calorie-tracker" — renaming
// those would move URLs and break the deployment for no user-visible gain.
export const metadata: Metadata = {
  title: "AI Cal Boy",
  description: "Snap a photo of your food and track calories & macros with Gemini.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    // Home Screen labels truncate around 12 characters; "AI Cal Boy" fits, so
    // this can now match the title instead of shortening to "Calories".
    title: "AI Cal Boy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f6f1e7",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
