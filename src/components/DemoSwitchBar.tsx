"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, ShieldCheck } from "lucide-react";

export function DemoSwitchBar() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <div className="sticky top-0 z-50 bg-[#191f28] text-white border-b border-slate-800 shadow-sm">
      <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            프로토타입 시연 모드
          </span>
          <span className="text-slate-300 truncate hidden sm:inline">
            손님용 주문 웹과 사장님용 자동집계 화면을 전환해 보세요
          </span>
        </div>

        <div className="flex items-center bg-slate-800/90 p-0.5 rounded-lg shrink-0">
          <Link
            href="/"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              !isAdmin
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>손님 주문 화면</span>
          </Link>
          <Link
            href="/admin"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              isAdmin
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>사장님 관리자 (/admin)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
