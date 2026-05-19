// NextAuth v5 — re-export the GET/POST handlers from lib/auth.ts.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
