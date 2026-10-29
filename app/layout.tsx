import { FeedbackProvider } from "@/components/feedback-provider";
import type { Metadata } from "next";
import "@/components/arc/foundation.css";
import "./globals.css";
export const metadata: Metadata = { title: "Forma", description: "Your tasks and links, together on your Mac." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="dark" data-accent="neutral"><body><FeedbackProvider>{children}</FeedbackProvider></body></html>;
}
