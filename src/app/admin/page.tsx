"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import Link from "next/link";
import { filterOrderPeriod } from "@/lib/order-period";
import {
  getKstDateString,
  buildProductAggregations,
} from "@/lib/store-helpers";
import { useModalAccessibility } from "@/lib/use-modal-accessibility";
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
  PublicStoreSettings,
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

  const [settings, setSettings] = useState<PublicStoreSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allOrders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"TODAY" | "RANGE" | "ALL">("TODAY");
  const [fromDate, setFromDate] = useState(getKstDateString);
  const [toDate, setToDate] = useState(getKstDateString);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const markDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const adminRequestId = useRef(0);
  const settingsBaseline = useRef<PublicStoreSettings | null>(null);
  const from =
    period === "ALL"
      ? undefined
      : period === "TODAY"
        ? getKstDateString()
        : fromDate;
  const to =
    period === "ALL"
      ? undefined
      : period === "TODAY"
        ? getKstDateString()
        : toDate;
  const orders = useMemo(
    () => filterOrderPeriod(allOrders, from, to),
    [allOrders, from, to],
  );
  const scopedAggregations = useMemo(
    () => buildProductAggregations(products, orders),
    [products, orders],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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
    "설향 딸기 2팩\n샤인머스켓 1박스 예약이요",
  );
  const [botReply, setBotReply] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchAdminData = useCallback(async () => {
    const requestId = ++adminRequestId.current;
    try {
      const params = new URLSearchParams({
        admin: "1",
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      const res = await fetch(`/api/bootstrap?${params}`, {
        cache: "no-store",
      });
      if (requestId !== adminRequestId.current) return false;
      if (res.status === 401) {
        setIsUnlocked(false);
        return false;
      }
      if (!res.ok) {
        showToast(
          "데이터 조회에 실패했습니다. 기존 결과를 최신으로 간주하지 마세요.",
        );
        return false;
      }
      const data = await res.json();
      if (requestId !== adminRequestId.current) return false;
      setDataMode(data.mode ?? null);
      if (!dirtyRef.current) {
        setSettings(data.settings);
        settingsBaseline.current = data.settings;
      }
      setProducts(data.products ?? []);
      setOrders(data.orders ?? []);
      setLastUpdatedAt(formatClockNow());
      setIsUnlocked(true);
      return true;
    } catch {
      showToast("네트워크 오류로 데이터를 갱신하지 못했습니다.");
      return false;
    } finally {
      if (requestId === adminRequestId.current) setLoading(false);
    }
  }, [from, to, showToast]);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleRefreshTab = async (tab: AdminTab, label: string) => {
    if (dirtyRef.current && !confirm("미저장 변경을 버리고 새로고침할까요?"))
      return;
    dirtyRef.current = false;
    setDirty(false);
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

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        isUnlocked &&
        !dirtyRef.current &&
        !busyRef.current
      )
        void fetchAdminData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchAdminData, isUnlocked]);
  useModalAccessibility(noticeModalOpen, () => setNoticeModalOpen(false));
  const runMutation = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch {
      showToast(
        "네트워크 오류가 발생했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // 관리자 비밀번호 인증
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }

    if (isVerifyingPin) return;
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
      showToast("🔓 사장님 관리자 모드로 접속되었습니다.");
    } catch {
      setAuthError("로그인 요청에 실패했습니다. 네트워크를 확인해 주세요.");
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
  };

  // 데모 데이터 초기화
  const handleResetDemo = async () => {
    if (!confirm("데모 데이터와 설정을 초기화하고 로그아웃할까요?")) return;
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
      setLastUpdatedAt(formatClockNow());
      setIsUnlocked(false);
      showToast(
        "🔄 샘플 데이터가 초기 상태로 복원되었습니다. 다시 로그인해 주세요.",
      );
    }
  };

  // 주문 상태 원터치 변경
  const handleUpdateOrder = async (
    orderId: string,
    patch: { status?: OrderStatus; is_paid?: boolean },
  ) => {
    if (
      patch.status === "CANCELED" &&
      !confirm(
        "주문을 취소할까요? 한정 재고가 복구됩니다. 입금 환불은 별도로 확인해 주세요.",
      )
    )
      return;
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
    setLastUpdatedAt(formatClockNow());
    showToast("✅ 주문 상태가 즉시 반영되었습니다.");
  };

  // 과일 상태 및 재고 수정
  const handlePatchProduct = async (
    productId: string,
    patch: Partial<Product>,
    successMsg: string,
    expectedVersion?: number,
  ): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          patch,
          expected_stock_version:
            expectedVersion ??
            products.find((p) => p.id === productId)?.stock_version ??
            0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "상품 변경 실패");
        return false;
      }
      setProducts(data.products);
      setLastUpdatedAt(formatClockNow());
      await fetchAdminData();
      showToast(successMsg);
      return true;
    } catch {
      showToast("상품 저장에 실패했습니다. 입력값은 보존됩니다.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // 과일 노출 순서 일괄 변경
  const handleReorderProducts = async (orderedIds: string[]) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder_ids: orderedIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "상품 노출 순서 저장 실패");
      return;
    }
    setProducts(data.products);
    setLastUpdatedAt(formatClockNow());
    await fetchAdminData();
    showToast("✅ 손님 화면 노출 순서가 저장되었습니다.");
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
    setLastUpdatedAt(formatClockNow());
    await fetchAdminData();
    showToast("📦 재고 수량이 즉시 반영되었습니다.");
  };

  // 과일 등록
  const handleCreateProduct = async (
    input: CreateProductInput,
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
    setLastUpdatedAt(formatClockNow());
    await fetchAdminData();
    showToast("🍎 새 과일이 등록되어 손님 주문 화면에 즉시 노출됩니다!");
    return true;
  };

  // 과일 삭제
  const handleDeleteProduct = async (productId: string, name: string) => {
    if (
      !confirm(
        `\'${name}\' 상품을 삭제할까요? 기존 주문 품목·금액은 보존되지만 현재 상품 목록·집계에서는 제외됩니다. 일시 판매중단은 숨김을 사용하세요.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/products?id=${productId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "상품 삭제에 실패했습니다.");
      return;
    }
    setProducts(data.products);
    setLastUpdatedAt(formatClockNow());
    await fetchAdminData();
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
        messageId: crypto.randomUUID(),
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

  // CSV 다운로드
  const handleDownloadCsv = () => {
    const csvContent = `조회 기준: 주문일(KST),${from || "전체"},${to || "전체"}\n${ordersToCsv(orders)}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `과일주문집계_${`${from || "전체"}_${to || "전체"}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📊 엑셀(CSV) 파일 다운로드가 시작되었습니다.");
  };

  // 상단 KPI 요약 통계
  const kpiStats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "CANCELED");
    const totalRevenue = activeOrders.reduce(
      (sum, o) => sum + o.total_amount,
      0,
    );
    const waitingCount = activeOrders.filter(
      (o) => o.status === "RESERVED" || o.status === "READY",
    ).length;
    const pickedUpCount = activeOrders.filter(
      (o) => o.status === "PICKED_UP",
    ).length;

    return {
      totalOrders: activeOrders.length,
      totalRevenue,
      paidRevenue: activeOrders
        .filter((o) => o.is_paid)
        .reduce((sum, o) => sum + o.total_amount, 0),
      unpaidRevenue: activeOrders
        .filter((o) => !o.is_paid)
        .reduce((sum, o) => sum + o.total_amount, 0),
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

  const changeTab = (tab: AdminTab) => {
    if (dirtyRef.current && !confirm("미저장 변경을 버리고 탭을 이동할까요?"))
      return;
    dirtyRef.current = false;
    setDirty(false);
    if (settingsBaseline.current) setSettings(settingsBaseline.current);
    setActiveTab(tab);
  };

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
              <span className="font-bold text-slate-100">
                사장님 전용 관리자
              </span>
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
              <h1 className="text-lg font-extrabold">
                사장님 전용 관리자 인증
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                관리자 비밀번호를 입력해야 장부와 상품 관리에 접근할 수
                있습니다.
              </p>
            </div>
            <div className="relative">
              <label htmlFor="admin-page-input-1" className="sr-only">
                관리자 비밀번호 입력
              </label>
              <input
                id="admin-page-input-1"
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
                {showPin ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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

      {busy && (
        <div
          role="status"
          className="fixed inset-0 z-[80] bg-black/20 flex items-center justify-center"
        >
          <div className="rounded-xl bg-white p-4 shadow-xl text-sm font-bold">
            처리 중입니다…
          </div>
        </div>
      )}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* 1. 상단 관리자 헤더 & KPI 요약 카드 (유지) + 4개 분리 탭 네비게이션 */}
        <section className="bg-white rounded-2xl p-3 shadow-xs border border-slate-100 space-y-3">
          {activeTab === "DASHBOARD" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold">
                  👨‍🌾 사장님 모바일 관리 센터
                </span>
                <h1 className="text-xl font-black text-slate-900 mt-1">
                  {settings?.store_name || "후르츠파머 유천점"} 주문 장부
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
          )}
          {(activeTab === "DASHBOARD" || activeTab === "ORDERS") && (
            <div
              className="flex flex-wrap gap-2 items-center text-xs"
              aria-label="주문일 조회 기간"
            >
              {(["TODAY", "RANGE", "ALL"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  className={`px-3 py-2 rounded-xl font-bold ${period === p ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "TODAY"
                    ? "오늘(KST)"
                    : p === "RANGE"
                      ? "기간"
                      : "전체"}
                </button>
              ))}
              {period === "RANGE" && (
                <>
                  <label htmlFor="period-from" className="sr-only">
                    조회 시작일
                  </label>
                  <input
                    id="period-from"
                    aria-label="조회 시작일"
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="min-w-0 max-w-full rounded-lg border p-2"
                  />
                  <label htmlFor="period-to" className="sr-only">
                    조회 종료일
                  </label>
                  <input
                    id="period-to"
                    aria-label="조회 종료일"
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="min-w-0 max-w-full rounded-lg border p-2"
                  />
                </>
              )}
              <span className="text-slate-500">
                주문일 기준 · 목록/집계/CSV 공통
              </span>
            </div>
          )}
          {/* 선택 기간 KPI */}
          {activeTab === "DASHBOARD" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400">
                    선택 기간 유효 주문
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">
                    {kpiStats.totalOrders}건
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <p className="text-[11px] font-bold text-emerald-700">
                    선택 기간 예약금액
                  </p>
                  <p className="text-xl font-black text-emerald-800 mt-0.5">
                    {formatKRW(kpiStats.totalRevenue)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <p className="text-[11px] font-bold text-amber-700">
                    픽업 대기 중
                  </p>
                  <p className="text-xl font-black text-amber-900 mt-0.5">
                    {kpiStats.waitingCount}건
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-700">
                    수령(픽업) 완료
                  </p>
                  <p className="text-xl font-black text-blue-900 mt-0.5">
                    {kpiStats.pickedUpCount}건
                  </p>
                </div>
              </div>

              <div className="text-xs flex flex-wrap gap-3">
                <span>입금 완료 {formatKRW(kpiStats.paidRevenue)}</span>
                <span>미입금 {formatKRW(kpiStats.unpaidRevenue)}</span>
                <span>입금 확인 기준 · 취소 제외</span>
              </div>
            </>
          )}
          {/* 4개 분리 탭 네비게이션 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => changeTab("DASHBOARD")}
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
              onClick={() => changeTab("ORDERS")}
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
              onClick={() => changeTab("PRODUCTS")}
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
              onClick={() => changeTab("SETTINGS")}
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
            aggregations={scopedAggregations}
            orders={orders}
            isRefreshing={refreshingTab === "DASHBOARD"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() =>
              void handleRefreshTab("DASHBOARD", "판매 대시보드")
            }
            onPatchProduct={handlePatchProduct}
            onJumpToOrders={(filter) => {
              setOrderFilter(filter);
              changeTab("ORDERS");
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
            onUpdateOrder={(id, patch) =>
              runMutation(() => handleUpdateOrder(id, patch))
            }
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
            onReorderProducts={(ids) =>
              runMutation(() => handleReorderProducts(ids))
            }
            onAdjustStock={(id, delta) =>
              runMutation(() => handleAdjustProductStock(id, delta))
            }
            onDeleteProduct={(id, name) =>
              runMutation(() => handleDeleteProduct(id, name))
            }
            showToast={showToast}
            onDirtyChange={markDirty}
          />
        )}

        {activeTab === "SETTINGS" && settings && (
          <AdminSettingsTab
            settings={settings}
            onSaved={(value) => {
              setSettings(value);
              settingsBaseline.current = value;
            }}
            onDirtyChange={markDirty}
            onPasswordChanged={() => {
              setDirty(false);
              setIsUnlocked(false);
            }}
            isRefreshing={refreshingTab === "SETTINGS"}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefreshTab("SETTINGS", "매장 설정")}
          />
        )}
      </main>

      {/* 오픈카톡 공지 홍보글 자동 생성 모달 */}
      {noticeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="공구방 공지 생성"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
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
