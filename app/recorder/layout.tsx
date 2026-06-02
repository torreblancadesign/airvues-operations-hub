// Minimal chrome layout for the recorder popup window.
// Lives at /recorder (outside the (app) group) so it does NOT inherit the
// sidebar/topbar/command palette shell — meant to be opened as a small popup.
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import "../globals.css";

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
  return (
    <html lang="en">
      <body className="bg-bg text-ink antialiased min-h-screen">
        <div className="min-h-screen px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </body>
    </html>
  );
}
