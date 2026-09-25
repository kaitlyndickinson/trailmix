import { requireUser } from "@/lib/supabase/server";
import { getPrimaryCrew } from "@/lib/crew";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { createInvite, renameCrew, revokeInvite } from "./actions";
import { InviteShare } from "./invite-share";
import { JoinForm } from "./join-form";

export default async function CrewPage({ searchParams }: PageProps<"/crew">) {
  const { joined } = await searchParams;
  const { supabase, userId } = await requireUser();
  const crew = await getPrimaryCrew(supabase, userId);
  if (!crew) {
    return (
      <div className={cardClass}>
        <h1 className="font-semibold">You&apos;re not in a crew yet</h1>
        <div className="mt-3">
          <JoinForm prominent />
        </div>
      </div>
    );
  }

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("crew_members")
      .select("user_id, role, profiles(display_name)")
      .eq("crew_id", crew.id)
      .order("created_at"),
    supabase
      .from("crew_invites")
      .select("id, code, expires_at")
      .eq("crew_id", crew.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {joined && (
        <p className="bg-forest/10 text-forest rounded-xl p-3" role="status">
          You&apos;re in! Trips from this crew now show up on your Trips tab.
        </p>
      )}

      <section>
        <p className="text-forest text-xs font-semibold tracking-widest uppercase">
          Your crew
        </p>
        <form action={renameCrew} className="mt-2 flex gap-2">
          <input type="hidden" name="crew_id" value={crew.id} />
          <input
            name="name"
            defaultValue={crew.name}
            aria-label="Crew name"
            maxLength={80}
            required
            className={`${inputClass} text-lg font-semibold`}
          />
          <button type="submit" className={secondaryButtonClass}>
            Save
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 font-semibold">Members</h2>
        <ul className="flex flex-col">
          {members?.map((m) => (
            <li key={m.user_id} className="flex min-h-12 items-center gap-3">
              <span
                aria-hidden
                className="bg-sand text-forest flex size-9 items-center justify-center rounded-full font-semibold"
              >
                {(m.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1">
                {m.profiles?.display_name}
                {m.user_id === userId && (
                  <span className="text-foreground/50"> (you)</span>
                )}
              </span>
              {m.role === "owner" && (
                <span className="text-foreground/50 text-xs">owner</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Invite someone</h2>
        <p className="text-foreground/70 mt-1 text-sm">
          Each code works once and expires in 7 days.
        </p>

        {invites && invites.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {invites.map((inv) => (
              <li key={inv.id} className="bg-background rounded-xl p-3">
                <p className="text-forest font-mono text-2xl tracking-[0.2em]">
                  {inv.code}
                </p>
                <p className="text-foreground/50 text-xs">
                  Expires{" "}
                  {new Date(inv.expires_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <div className="mt-2 flex gap-2">
                  <InviteShare code={inv.code} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button type="submit" className={secondaryButtonClass}>
                      Revoke
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={createInvite} className="mt-4">
          <input type="hidden" name="crew_id" value={crew.id} />
          <button type="submit" className={`${primaryButtonClass} w-full`}>
            Create invite code
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 font-semibold">Have a code?</h2>
        <JoinForm />
      </section>
    </div>
  );
}
