"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, primaryButtonClass } from "@/components/ui";

export type ChecklistItem = {
  id: string;
  label: string;
  category: string | null;
  sort: number;
  checked: boolean;
  checked_by: string | null;
};

const SELECT = "id, label, category, sort, checked, checked_by";
const UNCATEGORIZED = "Other";

export function Checklist({
  tripId,
  initialItems,
  names,
}: {
  tripId: string;
  initialItems: ChecklistItem[];
  names: Record<string, string>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const pendingRefetch = useRef(false);

  // Live sync: any change from the other phone triggers a refetch.
  useEffect(() => {
    async function refetch() {
      if (pendingRefetch.current) return;
      pendingRefetch.current = true;
      const { data } = await supabase
        .from("checklist_items")
        .select(SELECT)
        .eq("trip_id", tripId)
        .order("sort");
      pendingRefetch.current = false;
      if (data) setItems(data);
    }

    const channel = supabase
      .channel(`checklist:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void refetch(),
      )
      .subscribe();

    // Catch up when the app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, tripId]);

  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.sort - b.sort);
    const map = new Map<string, ChecklistItem[]>();
    for (const item of sorted) {
      const key = item.category || UNCATEGORIZED;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  const checkedCount = items.filter((i) => i.checked).length;

  function fail(message: string, rollback: ChecklistItem[]) {
    setItems(rollback);
    setError(message);
  }

  async function toggle(item: ChecklistItem) {
    const before = items;
    setError(null);
    setItems((cur) =>
      cur.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ checked: !item.checked })
      .eq("id", item.id)
      .select(SELECT)
      .single();
    if (error) return fail(error.message, before);
    setItems((cur) => cur.map((i) => (i.id === data.id ? data : i)));
  }

  async function remove(item: ChecklistItem) {
    const before = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", item.id);
    if (error) fail(error.message, before);
  }

  async function move(item: ChecklistItem, direction: -1 | 1) {
    const group = groups.find(
      ([key]) => key === (item.category || UNCATEGORIZED),
    );
    if (!group) return;
    const list = group[1];
    const index = list.findIndex((i) => i.id === item.id);
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
        .from("checklist_items")
        .update({ sort: other.sort })
        .eq("id", item.id),
      supabase
        .from("checklist_items")
        .update({ sort: item.sort })
        .eq("id", other.id),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) fail(failed.error.message, before);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    const category = newCategory || null;
    const maxSort = items.reduce((m, i) => Math.max(m, i.sort), 0);
    setNewLabel("");
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ trip_id: tripId, label, category, sort: maxSort + 10 })
      .select(SELECT)
      .single();
    if (error) {
      setNewLabel(label);
      return setError(error.message);
    }
    setItems((cur) =>
      cur.some((i) => i.id === data.id) ? cur : [...cur, data],
    );
  }

  const categories = groups
    .map(([key]) => key)
    .filter((k) => k !== UNCATEGORIZED);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div
          className="bg-sand h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={checkedCount}
          aria-label="Checklist progress"
        >
          <div
            className="bg-forest h-full rounded-full transition-all"
            style={{
              width: items.length
                ? `${(checkedCount / items.length) * 100}%`
                : 0,
            }}
          />
        </div>
        <span className="text-foreground/60 font-mono text-sm">
          {checkedCount}/{items.length}
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-forest min-h-11 px-2 text-sm font-medium"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

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
          Nothing on the list yet. Add something below.
        </p>
      )}

      {groups.map(([category, list]) => (
        <section key={category}>
          <h3 className="text-forest mb-1 text-xs font-semibold tracking-widest uppercase">
            {category}
          </h3>
          <ul className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
            {list.map((item, index) => (
              <li key={item.id} className="flex items-center">
                <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => void toggle(item)}
                    className="accent-forest size-5 shrink-0"
                  />
                  <span
                    className={
                      item.checked
                        ? "text-foreground/40 line-through"
                        : undefined
                    }
                  >
                    {item.label}
                  </span>
                </label>
                {!editing && item.checked && item.checked_by && (
                  <span
                    title={`Checked by ${names[item.checked_by] ?? "someone"}`}
                    className="bg-forest/10 text-forest mr-3 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {(names[item.checked_by] ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                {editing && (
                  <div className="flex shrink-0">
                    <IconButton
                      label={`Move ${item.label} up`}
                      disabled={index === 0}
                      onClick={() => void move(item, -1)}
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      label={`Move ${item.label} down`}
                      disabled={index === list.length - 1}
                      onClick={() => void move(item, 1)}
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
                  </div>
                )}
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
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add an item…"
          aria-label="New item"
          maxLength={200}
          className={inputClass}
        />
        <div className="flex gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            aria-label="Category"
            className={`${inputClass} flex-1`}
          >
            <option value="">{UNCATEGORIZED}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
      className={`flex size-11 items-center justify-center text-lg disabled:opacity-25 ${
        danger ? "text-red-700" : "text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}
