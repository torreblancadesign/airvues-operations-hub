// Minimal-chrome route for the recorder popup. The root layout owns html/body.
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";

export const metadata = {
  title: "Meeting recorder · Airvues",
};

export default async function RecorderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session?.user?.role) {
    redirect("/login?redirect=/recorder");
  }
  return <div className="min-h-screen px-4 py-4 sm:px-5 sm:py-5">{children}</div>;
}
