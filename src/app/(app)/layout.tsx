import { requireUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { BottomNav } from "./bottom-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b border-black/10 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <span className="text-forest text-lg font-semibold">trailmix</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-foreground/70 min-h-11 px-2 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
