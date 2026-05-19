import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import { auth, signIn } from "@/lib/auth";
import { SAML_COOKIE_NAME, verifySamlSession } from "@/lib/samlSession";
import { AuroraBackdrop } from "@/components/login/AuroraBackdrop";
import { Manifesto } from "@/components/login/Manifesto";
import { LiveClock } from "@/components/login/LiveClock";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const sp = await searchParams;

  const nextSession = await auth();
  if (nextSession?.user?.email) {
    redirect(sp.from || "/");
  }

  const samlToken = (await cookies()).get(SAML_COOKIE_NAME)?.value;
  const samlSession = samlToken ? await verifySamlSession(samlToken) : null;
  if (samlSession) {
    redirect(sp.from || "/");
  }

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: sp.from || "/" });
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen relative bg-bg overflow-hidden">
      <AuroraBackdrop />

      <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-0">
        {/* ── Brand panel ─────────────────────────────────────────── */}
        <section className="relative flex flex-col justify-between px-8 py-12 lg:px-16 lg:py-16">
          <header className="flex items-center gap-3">
            <Image
              src="/airvues-mark.png"
              alt="Airvues"
              width={44}
              height={47}
              priority
              className="login-mark"
            />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint">
                Airvues
              </div>
              <div className="text-[15px] font-semibold text-ink-strong leading-none mt-1">
                Operations
              </div>
            </div>
          </header>

          <div className="my-12 lg:my-0 max-w-xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-faint mb-6">
              ◆ Internal control plane
            </div>
            <h1 className="text-[36px] sm:text-[44px] lg:text-[52px] font-semibold text-ink-strong leading-[1.05] tracking-tight mb-8">
              The systems
              <br />
              behind the systems.
            </h1>
            <div className="text-[18px] sm:text-[20px] text-ink-muted font-light leading-snug">
              <Manifesto />
            </div>
          </div>

          <footer className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-faint">
            <span>Airvues LLC · © {year}</span>
            <LiveClock />
          </footer>
        </section>

        {/* ── Sign-in card ─────────────────────────────────────────── */}
        <section className="relative grid place-items-center px-4 sm:px-8 pb-12 lg:py-16 lg:pr-16">
          <div className="relative w-full max-w-md bg-surface/85 backdrop-blur-xl border border-rule rounded-card p-10 shadow-2xl">
            <div
              className="absolute top-0 left-10 right-10 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(34, 211, 168, 0.45), transparent)",
              }}
              aria-hidden="true"
            />

            <h2 className="text-[26px] font-semibold text-ink-strong mb-2 leading-tight tracking-tight">
              Sign in
            </h2>
            <p className="text-ink-muted text-[13px] mb-8 leading-relaxed">
              Continue with your Airvues Google account.
            </p>

            {errorMsg && (
              <div className="mb-6 p-3 bg-red-soft border border-red/30 rounded text-[12px] text-red leading-relaxed">
                {errorMsg}
              </div>
            )}

            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="w-full bg-white text-[#1f1f1f] py-2.5 px-5 rounded font-semibold text-[13px] hover:bg-white/95 hover:shadow-lg transition-all flex items-center justify-center gap-2.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </form>

            <div className="mt-10 pt-5 border-t border-rule flex items-center justify-between text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              <span>Restricted</span>
              <span className="tabnum">v1.0</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
