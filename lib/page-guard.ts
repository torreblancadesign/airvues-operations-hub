// Server-side page guard. Call at the top of any (app) page that is gated by
// a Permission. Reads the current session and redirects to "/" if denied.
import "server-only";
import { redirect } from "next/navigation";
import { getAppSession } from "./session";
import { canAccessRoute } from "./permissions";

export async function assertCanAccess(href: string): Promise<void> {
  const session = await getAppSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!canAccessRoute(session.user.permissions, href, session.user.role)) {
    redirect("/");
  }
}
