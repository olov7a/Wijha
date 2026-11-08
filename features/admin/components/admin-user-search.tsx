"use client";

import { useState, useTransition } from "react";
import { findUsers, setUserRole, type FoundUser } from "@/app/actions/roles";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { CheckIcon, SearchIcon } from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";

const ROLES = ["student", "owner", "team", "leader", "admin"] as const;

export function AdminUserSearch() {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<FoundUser[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);

  const labels =
    locale === "ar"
      ? {
          title: "ترقية حساب بإيميله",
          hint: "اكتب الإيميل أو جزء منه (أو الاسم) وأختار الدور — من غير ما تحتاج الـ UUID.",
          placeholder: "abdo@wijha.test",
          search: "ابحث",
          searching: "بيبحث...",
          empty: "لا توجد نتائج مطابقة.",
          promote: "تغيير الدور",
          changed: "تم التحديث",
          role: "الدور",
        }
      : {
          title: "Promote by email",
          hint: "Type (part of) an email or name and pick a role — no UUID needed.",
          placeholder: "abdo@wijha.test",
          search: "Search",
          searching: "Searching...",
          empty: "No matching accounts.",
          promote: "Change role",
          changed: "Updated",
          role: "Role",
        };

  function search() {
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await findUsers(query);
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setUsers(result.data.users);
      setSearched(true);
    });
  }

  function promote(user: FoundUser, role: (typeof ROLES)[number]) {
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await setUserRole({ userId: user.id, role });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, role } : u)));
      setNotice(labels.changed);
    });
  }

  return (
    <section className="mt-7 rounded-panel border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-base font-bold">{labels.title}</h2>
      <p className="mt-1 text-xs text-slate">{labels.hint}</p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          dir="ltr"
          className="min-w-56 flex-1 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-left"
        />
        <Button type="submit" size="sm" disabled={pending} variant="secondary">
          <SearchIcon className="size-4" />
          {pending ? labels.searching : labels.search}
        </Button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-xl bg-rejected-soft px-3 py-2 text-xs font-bold text-rejected-ink">{error}</p>}
      {notice && <p role="status" className="mt-3 flex items-center gap-1.5 rounded-xl bg-approved-soft px-3 py-2 text-xs font-bold text-approved-ink"><CheckIcon className="size-3.5" />{notice}</p>}

      {searched && users.length === 0 && <p className="mt-4 text-sm text-slate">{labels.empty}</p>}

      <div className="mt-4 space-y-2">
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" dir="ltr">{user.email ?? user.id.slice(0, 8)}</p>
              <p className="text-[11px] font-bold text-slate">{labels.role}: {user.role} {user.fullName ? `• ${user.fullName}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                defaultValue={user.role}
                onChange={(e) => promote(user, e.target.value as (typeof ROLES)[number])}
                disabled={pending}
                className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-bold"
                dir="ltr"
                aria-label={labels.promote}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
