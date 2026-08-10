import "server-only";

import { cookies } from "next/headers";
import { verifySession } from "./auth";

// Route handlers sit behind proxy.ts, but that is a single point of failure:
// one edit to its matcher or its public-path list would silently expose every
// handler. Each route re-checks the session so authorization does not depend
// on routing configuration staying correct.
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return false;

  const session = await verifySession(token);
  return Boolean(session?.authenticated);
}
