"use client";

import React, { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import type { StoreSettings } from "@/types/domain";

interface AdminSettingsTabProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings | null>>;
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
  onSaveSettings: (e: React.FormEvent) => Promise<void>;
}

export function AdminSettingsTab({
  settings,
  setSettings,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  onSaveSettings,
}: AdminSettingsTabProps) {
  const [showAdminPin, setShowAdminPin] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            ⚙️ 매장 · 오픈카톡방 설정
          </h2>
          <p className="text-xs text-slate-500">
            가게 상호명, 오픈카톡 링크, 계좌번호 및 관리자 비밀번호를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedAt && (
            <span className="text-[11px] font-medium text-slate-400">
              갱신 {lastUpdatedAt}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 shadow-2xs transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin text-emerald-600" : ""
              }`}
            />
            <span>{isRefreshing ? "새로고침 중..." : "설정 새로고침"}</span>
          </button>
        </div>
      </div>

      <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
        <form onSubmit={onSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                가게 상호명
              </label>
              <input
                type="text"
                value={settings.store_name}
                onChange={(e) =>
                  setSettings({ ...settings, store_name: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                상단 서브 배지 문구
              </label>
              <input
                type="text"
                value={settings.subtitle}
                onChange={(e) =>
                  setSettings({ ...settings, subtitle: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
            <label className="block text-xs font-extrabold text-amber-950">
              💬 오픈카톡 단톡방 링크 (테스트 / 실제 공구방 연결 주소)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.kakao_openchat_url}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    kakao_openchat_url: e.target.value,
                  })
                }
                placeholder="https://open.kakao.com/o/..."
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white border border-amber-200 text-sm font-mono"
              />
              {settings.kakao_openchat_url && (
                <a
                  href={settings.kakao_openchat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-[#FEE500] text-[#191919] text-xs font-extrabold flex items-center shrink-0 hover:brightness-95"
                >
                  테스트 열기
                </a>
              )}
            </div>
            <p className="text-[11px] text-amber-800">
              입력 후 아래 [설정 저장하기]를 누르면 손님 페이지 [공구방으로 이동]에 즉시
              적용됩니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              매장 공지사항 배너
            </label>
            <textarea
              rows={2}
              value={settings.notice_text}
              onChange={(e) =>
                setSettings({ ...settings, notice_text: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                영업시간 / 픽업 안내
              </label>
              <input
                type="text"
                value={settings.pickup_guide}
                onChange={(e) =>
                  setSettings({ ...settings, pickup_guide: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                계좌번호 안내
              </label>
              <input
                type="text"
                value={settings.bank_account}
                onChange={(e) =>
                  setSettings({ ...settings, bank_account: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              사장님 관리자 비밀번호
            </label>
            <div className="relative w-56">
              <input
                type={showAdminPin ? "text" : "password"}
                value={settings.admin_pin}
                onChange={(e) =>
                  setSettings({ ...settings, admin_pin: e.target.value })
                }
                className="w-full px-3.5 pr-10 py-2.5 rounded-xl bg-slate-100 text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => setShowAdminPin((prev) => !prev)}
                aria-label={showAdminPin ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {showAdminPin ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
          >
            설정 저장하기
          </button>
        </form>
      </section>
    </div>
  );
}
