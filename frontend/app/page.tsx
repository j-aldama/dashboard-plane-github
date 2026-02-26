import { redirect } from "next/navigation";

/**
 * Root page — redirect to the overview dashboard.
 * The overview route is implemented in EXEC-004.
 */
export default function Home() {
  redirect("/overview");
}
