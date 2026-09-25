"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, primaryButtonClass } from "@/components/ui";

type TemplateItem = {
  id: string;
  label: string;
  category: string | null;
  sort: number;
};

const SELECT = "id, label, category, sort";
const UNCATEGORIZED = "Other";

export function TemplateItems({
  templateId,
  initialItems,
}: {
  templateId: string;
  initialItems: TemplateItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const item of [...items].sort((a, b) => a.sort - b.sort)) {
      const key = item.category || UNCATEGORIZED;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);
  const categories = groups
    .map(([key]) => key)
    .filter((k) => k !== UNCATEGORIZED);

  function rollback(before: TemplateItem[], message: string) {
    setItems(before);
    setError(message);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = label.trim();
    if (!text) return;
    setError(null);
    setLabel("");
    const sort = items.reduce((m, i) => Math.max(m, i.sort), 0) + 10;
    const { data, error } = await supabase
      .from("checklist_template_items")
      .insert({
        template_id: templateId,
        label: text,
        category: category || null,
        sort,
      })
      .select(SELECT)
      .single();
    if (error) {
      setLabel(text);
      return setError(error.message);
    }
    setItems((cur) => [...cur, data]);
  }

  async function remove(item: TemplateItem) {
    const before = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const { error } = await supabase
      .from("checklist_template_items")
      .delete()
      .eq("id", item.id);
    if (error) rollback(before, error.message);
  }

  async function move(list: TemplateItem[], index: number, direction: -1 | 1) {
    const item = list[index];
    const other = list[index + direction];
    if (!other) return;
    const before = items;
    setItems((cur) =>
      cur.map((i) =>
        i.id === item.id
          ? { ...i, sort: other.sort }
          : i.id === other.id
            ? { ...i, sort: item.sort }
            : i,
      ),
    );
    const results = await Promise.all([
      supabase
        .from("checklist_template_items")
        .update({ sort: other.sort })
        .eq("id", item.id),
      supabase
        .from("checklist_template_items")
        .update({ sort: item.sort })
        .eq("id", other.id),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) rollback(before, failed.error.message);
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {groups.length === 0 && (
        <p className="text-foreground/60 text-center">
          No items yet. Add the first one below.
        </p>
      )}

      {groups.map(([group, list]) => (
        <section key={group}>
          <h2 className="text-forest mb-1 text-xs font-semibold tracking-widest uppercase">
            {group}
          </h2>
          <ul className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
            {list.map((item, index) => (
              <li key={item.id} className="flex min-h-12 items-center pl-3">
                <span className="flex-1">{item.label}</span>
                <IconButton
                  label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => void move(list, index, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Move ${item.label} down`}
                  disabled={index === list.length - 1}
                  onClick={() => void move(list, index, 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label={`Delete ${item.label}`}
                  onClick={() => void remove(item)}
                  danger
                >
                  ×
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <form
        onSubmit={add}
        className="bg-sand/60 flex flex-col gap-2 rounded-2xl p-3"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add an item…"
          aria-label="New item"
          maxLength={200}
          className={inputClass}
        />
        <div className="flex gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="template-categories"
            placeholder="Category (optional)"
            aria-label="Category"
            maxLength={40}
            className={`${inputClass} flex-1`}
          />
          <datalist id="template-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button type="submit" className={primaryButtonClass}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-11 shrink-0 items-center justify-center text-lg disabled:opacity-25 ${
        danger ? "text-red-700" : "text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}
