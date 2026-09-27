import { BottomNav } from "@/components/AppNav";
import { getSessionInfo } from "@/lib/session-server";

// Phone tab bar, only for signed-in people.
export default async function BottomNavSlot() {
  const session = await getSessionInfo();
  if (!session) return null;
  return <BottomNav email={session.email} isAdmin={session.isAdmin} />;
}
