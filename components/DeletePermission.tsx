"use client";

import { createContext, useContext } from "react";

// Whether the signed-in viewer may delete or archive records — the client-side
// mirror of canDelete() in lib/authz.ts (admin + lead).
//
// Provided once in the (app) layout instead of threaded as a prop: StorySheet
// alone is mounted on six pages, and a gate that has to be remembered at every
// call site is a gate that eventually isn't. This only decides whether the
// control renders; the real gate is deleteGate() inside each Server Action.
const Ctx = createContext(false);

export function DeletePermissionProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCanDelete(): boolean {
  return useContext(Ctx);
}
