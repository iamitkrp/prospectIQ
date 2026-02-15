import { redirect } from "next/navigation";

/**
 * Root page — redirects to the dashboard.
 * Auth middleware will bounce unauthenticated users to /login.
 */
export default function Home() {
  redirect("/prospects");
}
