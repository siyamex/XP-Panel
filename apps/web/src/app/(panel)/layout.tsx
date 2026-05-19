import { AppShell } from "@/components/layout/AppShell";
import { VoiceButton } from "@/components/ai/VoiceButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s — XP-Panel",
  },
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}<VoiceButton /></AppShell>;
}
