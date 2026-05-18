import { redirect } from "next/navigation";

// Root "/" redirects to dashboard (or login if not authenticated — handled client-side)
export default function RootPage() {
  redirect("/dashboard");
}
