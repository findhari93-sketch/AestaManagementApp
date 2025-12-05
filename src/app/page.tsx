import { redirect } from "next/navigation";

export default function Home() {
  // Middleware handles redirect for authenticated users to /site/dashboard
  // This is fallback for non-authenticated users
  redirect("/login");
}
