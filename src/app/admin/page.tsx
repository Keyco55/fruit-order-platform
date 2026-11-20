"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  EyeOff,
  Lock,
  MessageSquarePlus,
  PackagePlus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  AdminDashboardTab,
  type QuickOrderFilter,
} from "@/components/admin/AdminDashboardTab";
import { AdminOrdersTab } from "@/components/admin/AdminOrdersTab";
import { AdminProductsTab } from "@/components/admin/AdminProductsTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { copyTextSafe } from "@/lib/clipboard";
import {
  formatKRW,
  formatKakaoNoticeText,
  ordersToCsv,
} from "@/lib/formatters";
import type {
  CreateProductInput,
  Order,
  OrderStatus,
  Product,
  ProductAggregation,
  StoreSettings,
} from "@/types/domain";

type AdminTab = "DASHBOARD" | "ORDERS" | "PRODUCTS" | "SETTINGS";

function formatClockNow(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [dataMode, setDataMode] = useState<"supabase" | "demo" | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [aggregations, setAggregations] = useState<ProductAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [refreshingTab, setRefreshingTab] = useState<AdminTab | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // 고객 주문 현황 검색/필터
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<QuickOrderFilter>("ALL");
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);

  // 카톡 채팅 자동 파싱 시뮬레이터 상태
  const [botSender, setBotSender] = useState("단톡방어르신");
  const [botMessage, setBotMessage] = useState(
    "설향 딸기 2팩\n샤인머스켓 1박스 예약이요"
  );
  const [botReply, setBotReply] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap?admin=1", { cache: "no-store" });
      if (res.status === 401) {
        setIsUnlocked(false);
        return false;
      }
      if (!res.ok) return false;
      const data = await res.json();
      setDataMode(data.mode ?? null);
      setSettings(data.settings);
      setProducts(data.products ?? []);
      setOrders(data.orders ?? []);
      setAggregations(data.aggregations ?? []);
      setLastUpdatedAt(formatClockNow());
      setIsUnlocked(true);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleRefreshTab = async (tab: AdminTab, label: string) => {
    setRefreshingTab(tab);
    try {
      const ok = await fetchAdminData();
      if (ok) {
        showToast(`🔄 ${label} 최신 데이터를 불러왔습니다.`);
      } else {
        showToast("데이터 새로고침에 실패했습니다.");
      }
    } finally {
      setRefreshingTab(null);
    }
  };

  // 관리자 비밀번호 인증
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }

    setIsVerifyingPin(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_pin", pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error || "관리자 비밀번호가 일치하지 않습니다.";
        setAuthError(msg);
        showToast(msg);
        return;
      }
      setPinInput("");
      await fetchAdminData();
      setIsUnlocked(true);
      showToast("🔓 사장님 관리자 모드로 접속되었습니다.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // 관리자 잠금 (세션 로그아웃)
  const handleLockAdmin = async () => {
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setIsUnlocked(false);
    setPinInput("");
    setAuthError(null);
    setSettings(null);
    setProducts([]);
    setOrders([]);
    setAggregations([]);
  };

  // 데모 데이터 초기화
  const handleResetDemo = async () => {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_demo" }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setProducts(data.products);
      setOrders(data.orders);
      setAggregations(data.aggregations);
      setLastUpdatedAt(formatClockNow());
      showToast("🔄 샘플 데이터가 초기 상태로 복원되었습니다.");
    }
  };

  // 주문 상태 원터치 변경
  const handleUpdateOrder = async (
    orderId: string,
    patch: { status?: OrderStatus; is_paid?: boolean }
  ) => {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "상태 변경 실패");
      return;
    }
    setOrders(data.orders);
    setProducts(data.products);
    setAggregations(data.aggregations);
    setLastUpdatedAt(formatClockNow());
    showToast("✅ 주문 상태가 즉시 반영되었습니다.");
  };

  // 과일 상태 및 재고 수정
  const handlePatchProduct = async (
    productId: string,
    patch: Partial<Product>,
    successMsg: string
  ) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "상품 변경 실패");
      return;
    }
    setProducts(data.products);
    setAggregations(data.aggregations);
    setLastUpdatedAt(formatClockNow());
    showToast(successMsg);
  };

  // 과일 재고 원자적 증감 (H05)
  const handleAdjustProductStock = async (productId: string, delta: number) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, stock_delta: delta }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "재고 조정 실패");
      return;
    }
    setProducts(data.products);
    setAggregations(data.aggregations);
    setLastUpdatedAt(formatClockNow());
    showToast("📦 재고 수량이 즉시 반영되었습니다.");
  };

  // 과일 등록
  const handleCreateProduct = async (
    input: CreateProductInput
  ): Promise<boolean> => {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "과일 등록 실패");
      return false;
    }
    setProducts(data.products);
    setAggregations(data.aggregations);
    setLastUpdatedAt(formatClockNow());
    showToast("🍎 새 과일이 등록되어 손님 주문 화면에 즉시 노출됩니다!");
    return true;
  };

  // 과일 삭제
  const handleDeleteProduct = async (productId: string, name: string) => {
    const res = await fetch(`/api/admin/products?id=${productId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "상품 삭제에 실패했습니다.");
      return;
    }
    setProducts(data.products);
    setAggregations(data.aggregations);
    setLastUpdatedAt(formatClockNow());
    showToast(`🗑️ '${name}' 상품이 삭제되었습니다.`);
  };

  // 오픈카톡 채팅 자동인식 시뮬레이터 실행
  const handleSimulateKakaoBot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/webhook/kakao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: botSender,
        message: botMessage,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "시뮬레이션 오류");
      return;
    }
    setBotReply(data.reply);
    if (data.matched) {
      await fetchAdminData();
      showToast("🤖 카톡 채팅이 자동으로 주문 장부에 집계되었습니다!");
    } else {
      showToast("💬 일반 대화로 분류되어 집계에서 제외되었습니다.");
    }
  };

  // 매장 설정 저장
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (!settings.admin_pin.trim()) {
      showToast("관리자 비밀번호는 비워둘 수 없습니다.");
      return;
    }
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (res.ok) {
      setSettings(data.settings);
      setLastUpdatedAt(formatClockNow());
      showToast("💾 매장 설정 및 비밀번호가 저장되었습니다!");
    } else {
      showToast(data.error || "설정 저장에 실패했습니다.");
    }
  };

  // CSV 다운로드
  const handleDownloadCsv = () => {
    const csvContent = ordersToCsv(orders);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `과일주문집계_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📊 엑셀(CSV) 파일 다운로드가 시작되었습니다.");
  };

  // 상단 KPI 요약 통계
  const kpiStats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "CANCELED");
    const totalRevenue = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const waitingCount = activeOrders.filter(
      (o) => o.status === "RESERVED" || o.status === "READY"
    ).length;
    const pickedUpCount = activeOrders.filter(
      (o) => o.status === "PICKED_UP"
    ).length;

    return {
      totalOrders: activeOrders.length,
      totalRevenue,
      waitingCount,
      pickedUpCount,
    };
  }, [orders]);

  const kakaoNoticeText = useMemo(() => {
    if (!settings) return "";
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://fruit-order-platform.vercel.app";
    return formatKakaoNoticeText(settings, products, origin);
  }, [settings, products]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-sm text-slate-300 font-semibold">
          관리자 인증 상태를 확인하는 중...
        </p>
      </div>
    );
  }

  // 관리자 비밀번호 잠금 화면
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <header className="sticky top-0 z-50 bg-[#191f28] text-white border-b border-slate-800 shadow-sm">
          <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-100">사장님 전용 관리자</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span>손님 주문 화면</span>
            </Link>
          </div>
        </header>

        <div className="max-w-sm mx-auto px-4 pt-20">
          <form
            onSubmit={handleVerifyPin}
            className="bg-slate-800 rounded-3xl p-6 space-y-4 border border-slate-700 shadow-2xl text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">사장님 전용 관리자 인증</h1>
              <p className="text-xs text-slate-400 mt-1">
                관리자 비밀번호를 입력해야 장부와 상품 관리에 접근할 수 있습니다.
              </p>
            </div>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                inputMode="text"
                autoComplete="current-password"
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="관리자 비밀번호 입력"
                className="w-full text-center text-lg tracking-wider font-bold py-3 px-10 rounded-2xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                aria-label={showPin ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {authError && (
              <p className="text-xs font-semibold text-rose-400">{authError}</p>
            )}
            <button
              type="submit"
              disabled={isVerifyingPin}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold text-sm transition"
            >
              {isVerifyingPin ? "인증 확인 중..." : "관리자 페이지 입장"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#F2F4F6]">
      <header className="sticky top-0 z-50 bg-[#191f28] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-3 h-3" />
              <span>사장님 관리자</span>
            </span>
            {dataMode && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                  dataMode === "supabase"
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {dataMode === "supabase" ? "Supabase 실DB" : "데모 모드"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span>손님 주문 화면</span>
            </Link>
            <button
              type="button"
              onClick={handleLockAdmin}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-200 font-semibold transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>잠금</span>
            </button>
          </div>
        </div>
      </header>

      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-[#191f28] text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* 1. 상단 관리자 헤더 & KPI 요약 카드 (유지) + 4개 분리 탭 네비게이션 */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold">
                👨‍🌾 사장님 모바일 관리 센터
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-1">
                {settings?.store_name || "후르츠파머 유천점"} 실시간 장부
              </h1>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setNoticeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FEE500] text-[#191919] text-xs font-extrabold hover:brightness-95 shadow-2xs"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>단톡방 공지글 생성</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>엑셀(CSV)</span>
              </button>
              {dataMode === "demo" && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  title="데모 샘플 데이터를 처음 상태로 되돌립니다"
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>데모 초기화</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLockAdmin}
                title="관리자 화면을 잠그고 로그아웃합니다"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 실시간 KPI 요약 카드 4개 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400">오늘 유효 주문</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {kpiStats.totalOrders}건
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <p className="text-[11px] font-bold text-emerald-700">
                오늘 예약 매출 합계
              </p>
              <p className="text-xl font-black text-emerald-800 mt-0.5">
                {formatKRW(kpiStats.totalRevenue)}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
              <p className="text-[11px] font-bold text-amber-700">픽업 대기 중</p>
              <p className="text-xl font-black text-amber-900 mt-0.5">
                {kpiStats.waitingCount}건
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
              <p className="text-[11px] font-bold text-blue-700">수령(픽업) 완료</p>
              <p className="text-xl font-black text-blue-900 mt-0.5">
                {kpiStats.pickedUpCount}건
              </p>
            </div>
          </div>

          {/* 4개 분리 탭 네비게이션 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setActiveTab("DASHBOARD")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "DASHBOARD"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>판매 대시보드</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ORDERS")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "ORDERS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ClipboardList className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>고객 주문 현황</span>
              {kpiStats.waitingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                  {kpiStats.waitingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PRODUCTS")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "PRODUCTS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <PackagePlus className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>상품·재고 관리</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SETTINGS")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "SETTINGS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>매장 설정</span>
            </button>
          </div>
        </section>

        {/* 탭별 단일 화면 렌더링 (한 페이지에 모두 펼치지 않고 분리) */}
        {activeTab === "DASHBOARD" && (
          <AdminDashboardTab
            aggregations={aggregations}
            orders={orders}
            isRefreshing={refreshingTab === "DASHBOARD"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefreshTab("DASHBOARD", "판매 대시보드")}
            onPatchProduct={handlePatchProduct}
            onJumpToOrders={(filter) => {
              setOrderFilter(filter);
              setActiveTab("ORDERS");
            }}
          />
        )}

        {activeTab === "ORDERS" && (
          <AdminOrdersTab
            orders={orders}
            orderSearch={orderSearch}
            setOrderSearch={setOrderSearch}
            orderFilter={orderFilter}
            setOrderFilter={setOrderFilter}
            isRefreshing={refreshingTab === "ORDERS"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefreshTab("ORDERS", "고객 주문 현황")}
            onUpdateOrder={handleUpdateOrder}
            botSender={botSender}
            setBotSender={setBotSender}
            botMessage={botMessage}
            setBotMessage={setBotMessage}
            botReply={botReply}
            onSimulateKakaoBot={handleSimulateKakaoBot}
          />
        )}

        {activeTab === "PRODUCTS" && (
          <AdminProductsTab
            products={products}
            isRefreshing={refreshingTab === "PRODUCTS"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefreshTab("PRODUCTS", "상품·재고")}
            onCreateProduct={handleCreateProduct}
            onPatchProduct={handlePatchProduct}
            onAdjustStock={handleAdjustProductStock}
            onDeleteProduct={handleDeleteProduct}
            showToast={showToast}
          />
        )}

        {activeTab === "SETTINGS" && settings && (
          <AdminSettingsTab
            settings={settings}
            setSettings={setSettings}
            isRefreshing={refreshingTab === "SETTINGS"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefreshTab("SETTINGS", "매장 설정")}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </main>

      {/* 오픈카톡 공지 홍보글 자동 생성 모달 */}
      {noticeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                📢 오픈카톡 단톡방 공지글 자동 생성
              </h3>
              <button
                type="button"
                onClick={() => setNoticeModalOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                닫기
              </button>
            </div>

            <pre className="p-3.5 rounded-2xl bg-slate-100 text-xs text-slate-800 whitespace-pre-wrap font-sans max-h-80 overflow-y-auto leading-relaxed">
              {kakaoNoticeText}
            </pre>

            <button
              type="button"
              onClick={async () => {
                await copyTextSafe(kakaoNoticeText);
                showToast("📋 오늘의 과일 공지글이 클립보드에 복사되었습니다!");
                setNoticeModalOpen(false);
              }}
              className="w-full py-3.5 rounded-2xl bg-[#FEE500] text-[#191919] font-black text-sm flex items-center justify-center gap-1.5"
            >
              <Copy className="w-4 h-4" />
              <span>공지 문구 전체 복사하기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
