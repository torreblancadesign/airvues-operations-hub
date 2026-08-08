// The plan catalog folded into /retainers as a tab. This route stays only so
// an open tab, a bookmark, or a stale nav link lands in the right place
// instead of 404ing. Nothing renders here.
import { redirect } from "next/navigation";

export default function RetainerPlansRedirect(): never {
  redirect("/retainers?tab=plans");
}
