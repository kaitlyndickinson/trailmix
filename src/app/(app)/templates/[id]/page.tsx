import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";
import { deleteTemplate, renameTemplate } from "../actions";
import { TemplateItems } from "./template-items";

export default async function TemplatePage({
  params,
}: PageProps<"/templates/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: template }, { data: items }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("checklist_template_items")
      .select("id, label, category, sort")
      .eq("template_id", id)
      .order("sort"),
  ]);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/templates"
          className="text-forest -ml-1 inline-flex min-h-11 items-center px-1 text-sm"
        >
          ← Templates
        </Link>
        <form action={renameTemplate} className="flex gap-2">
          <input type="hidden" name="id" value={template.id} />
          <input
            name="name"
            defaultValue={template.name}
            required
            maxLength={80}
            aria-label="Template name"
            className={`${inputClass} text-lg font-semibold`}
          />
          <button type="submit" className={secondaryButtonClass}>
            Save
          </button>
        </form>
      </div>

      <TemplateItems templateId={template.id} initialItems={items ?? []} />

      <form
        action={deleteTemplate}
        className="mt-4 border-t border-black/10 pt-6"
      >
        <input type="hidden" name="id" value={template.id} />
        <ConfirmSubmit
          message={`Delete the "${template.name}" template? Existing trips keep their checklists.`}
          className={`${dangerButtonClass} w-full`}
        >
          Delete template
        </ConfirmSubmit>
      </form>
    </div>
  );
}
