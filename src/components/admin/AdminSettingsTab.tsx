"use client";
import React, { useEffect, useRef, useState } from "react";
import type { PublicStoreSettings } from "@/types/domain";

interface Props {
  settings: PublicStoreSettings;
  onSaved: (settings: PublicStoreSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
  onPasswordChanged: () => void;
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
}
const fields = [
  ["store_name", "가게 상호명"],
  ["subtitle", "상단 서브 문구"],
  ["kakao_openchat_url", "오픈카톡 공구방 주소"],
  ["notice_text", "매장 공지사항"],
  ["pickup_guide", "영업시간 / 픽업 안내"],
  ["bank_account", "입금 계좌 안내"],
] as const;

export function AdminSettingsTab({
  settings,
  onSaved,
  onDirtyChange,
  onPasswordChanged,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
}: Props) {
  const [draft, setDraft] = useState(settings);
  const baseline = useRef(settings);
  const dirtyRef = useRef(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty =
    fields.some(([key]) => draft[key] !== baseline.current[key]) ||
    !!(current || next || confirmation);
  dirtyRef.current = dirty;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirtyRef.current) {
      baseline.current = settings;
      setDraft(settings);
    }
  }, [settings]);
  const submit = async (event: React.FormEvent, password: boolean) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (
      password &&
      fields.some(([key]) => draft[key] !== baseline.current[key]) &&
      !confirm(
        "매장 정보의 미저장 변경이 있습니다. 비밀번호 변경 후 로그아웃하면 해당 변경은 저장되지 않습니다. 계속할까요?",
      )
    )
      return;
    if (password && next !== confirmation) {
      setMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const patch = Object.fromEntries(
        fields
          .filter(([key]) => draft[key] !== baseline.current[key])
          .map(([key]) => [key, draft[key]]),
      );
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          password
            ? {
                action: "change_password",
                current_password: current,
                new_password: next,
              }
            : patch,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      if (password) {
        setCurrent("");
        setNext("");
        setConfirmation("");
        onDirtyChange(false);
        onPasswordChanged();
      } else {
        baseline.current = data.settings;
        setDraft(data.settings);
        onSaved(data.settings);
        setMessage("매장 설정을 저장했습니다.");
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "네트워크 오류입니다. 입력은 보존됩니다.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="font-extrabold">매장 설정</h2>
        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-2 text-xs"
          disabled={saving || isRefreshing}
          onClick={() => {
            if (dirty && !confirm("미저장 변경을 버리고 새로고침할까요?"))
              return;
            baseline.current = settings;
            setDraft(settings);
            setCurrent("");
            setNext("");
            setConfirmation("");
            setMessage("");
            dirtyRef.current = false;
            onDirtyChange(false);
            onRefresh();
          }}
        >
          설정 새로고침
        </button>
        <span className="text-xs text-slate-500">
          갱신 {lastUpdatedAt || "-"}
          {dirty ? " · 미저장 변경 있음" : ""}
        </span>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm whitespace-pre-wrap"
        >
          {message}
        </p>
      )}
      <form
        onSubmit={(e) => void submit(e, false)}
        className="rounded-2xl bg-white border p-4 space-y-4"
      >
        <h3 className="font-bold">매장 정보 · 고객 안내</h3>
        {fields.map(([key, title]) => (
          <div key={key}>
            <label
              htmlFor={`settings-${key}`}
              className="block text-xs font-bold mb-1"
            >
              {title}
            </label>
            {key === "notice_text" ? (
              <textarea
                id={`settings-${key}`}
                value={draft[key]}
                maxLength={1000}
                rows={3}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="w-full rounded-xl bg-slate-100 p-3 text-sm"
              />
            ) : (
              <input
                id={`settings-${key}`}
                type={key === "kakao_openchat_url" ? "url" : "text"}
                maxLength={1000}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="w-full rounded-xl bg-slate-100 p-3 text-sm"
              />
            )}
          </div>
        ))}
        <button
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50"
        >
          {saving ? "저장 중…" : "매장 설정 저장"}
        </button>
      </form>
      <form
        onSubmit={(e) => void submit(e, true)}
        className="rounded-2xl bg-white border p-4 space-y-3"
      >
        <h3 className="font-bold">관리자 비밀번호 변경</h3>
        <p className="text-xs text-slate-500">
          새 비밀번호는 12~128자입니다. 변경하면 모든 기존 관리자 세션이
          만료되어 다시 로그인해야 합니다.
        </p>
        <label htmlFor="password-current" className="block text-xs font-bold">
          현재 비밀번호
        </label>
        <input
          id="password-current"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-xl bg-slate-100 p-3"
        />
        <label htmlFor="password-next" className="block text-xs font-bold">
          새 비밀번호
        </label>
        <input
          id="password-next"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-xl bg-slate-100 p-3"
        />
        <label htmlFor="password-confirm" className="block text-xs font-bold">
          새 비밀번호 확인
        </label>
        <input
          id="password-confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="w-full rounded-xl bg-slate-100 p-3"
        />
        <button
          disabled={saving}
          className="w-full rounded-xl bg-slate-900 text-white py-3 font-bold disabled:opacity-50"
        >
          {saving ? "변경 중…" : "비밀번호 변경 후 로그아웃"}
        </button>
      </form>
    </div>
  );
}
