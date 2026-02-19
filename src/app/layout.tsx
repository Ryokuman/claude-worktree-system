import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worktree Handler",
  description: "Git worktree management dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        className="text-gray-100 min-h-screen"
        style={{ background: "linear-gradient(135deg, rgb(15,23,42) 0%, rgb(3,7,18) 50%, rgb(15,23,42) 100%)" }}
      >
        {children}
      </body>
    </html>
  );
}
