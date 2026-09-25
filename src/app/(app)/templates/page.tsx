import Link from "next/link";
import { getPrimaryCrew } from "@/lib/crew";
import { requireUser } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { createTemplate } from "./actions";

export default async function TemplatesPage() {
  const { supabase, userId } = await requireUser();
  const crew = await getPrimaryCrew(supabase, userId);
  const { data: templates } = crew
    ? await supabase
        .from("checklist_templates")
        .select("id, name, checklist_template_items(count)")
        .eq("crew_id", crew.id)
        .order("created_at")
    : { data: [] };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/crew"
          className="text-forest -ml-1 inline-flex min-h-11 items-center px-1 text-sm"
        >
          ← Crew
        </Link>
        <h1 className="text-2xl font-semibold">Checklist templates</h1>
        <p className="text-foreground/60 mt-1 text-sm">
          New trips can start their checklist from one of these. Editing a
          template doesn&apos;t change trips that already exist.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {(templates ?? []).map((t) => (
          <li key={t.id}>
            <Link
              href={`/templates/${t.id}`}
              className="active:bg-sand flex min-h-14 items-center justify-between rounded-2xl border border-black/10 bg-white px-4"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-foreground/50 font-mono text-xs">
                {t.checklist_template_items[0]?.count ?? 0} items
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <form
        action={createTemplate}
        className="bg-sand/60 flex gap-2 rounded-2xl p-3"
      >
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Winter hike"
          aria-label="New template name"
          className={inputClass}
        />
        <button type="submit" className={primaryButtonClass}>
          Create
        </button>
      </form>
    </div>
  );
}
