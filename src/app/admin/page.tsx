"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  PackagePlus,
  Settings,
  Search,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
  Lock,
  Sparkles,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  Bot,
  MessageSquarePlus,
  CreditCard,
  PackageCheck,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { DemoSwitchBar } from "@/components/DemoSwitchBar";
import {
  formatKRW,
  formatKakaoNoticeText,
  matchesKoreanSearch,
  ordersToCsv,
} from "@/lib/formatters";
import { copyTextSafe } from "@/lib/clipboard";
import { compressImageToWebpDataUrl } from "@/lib/image-compressor";
import type {
  Order,
  OrderStatus,
  Product,
  ProductAggregation,
  ProductCategory,
  StoreSettings,
} from "@/types/domain";

type AdminTab = "DASHBOARD" | "PRODUCTS" | "SETTINGS";
type OrderFilterStatus = "ALL" | "WAITING" | "READY" | "PICKED_UP" | "UNPAID";

const QUICK_FRUIT_PRESETS = [
  {
    name: "논산 설향 딸기 (특품)",
    unit_label: "500g 1팩",
    price: 12900,
    original_price: 15900,
    origin: "충남 논산",
    brix: "14.5 Brix",
    badge_text: "오늘 경매 1등품",
    description: "새벽 경매에서 가장 알이 굵고 향이 진한 설향 딸기입니다.",
    image:
      "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "김천 고당도 샤인머스켓",
    unit_label: "2kg 1박스 (2~3수)",
    price: 18500,
    original_price: 24000,
    origin: "경북 김천",
    brix: "18 Brix 보장",
    badge_text: "망고향 가득",
    description: "알이 굵고 아삭하며 망고향이 진하게 올라오는 특품입니다.",
    image:
      "https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "제주 서귀포 타이벡 감귤",
    unit_label: "3kg 1박스 (로얄과)",
    price: 15000,
    original_price: 18500,
    origin: "제주 서귀포",
    brix: "13.5 Brix",
    badge_text: "새콤달콤 로얄과",
    description: "껍질이 얇고 과즙이 풍부한 서귀포 타이벡 감귤입니다.",
    image:
      "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "고당도 백도 복숭아",
    unit_label: "4kg 1박스 (12~14과)",
    price: 24900,
    original_price: 29900,
    origin: "경북 영천",
    brix: "15 Brix",
    badge_text: "과즙 폭발",
    description: "향긋하고 부드러운 과육에 꿀당도를 자랑하는 백도 복숭아입니다.",
    image:
      "https://images.unsplash.com/photo-1629828874514-c1e5103f2150?auto=format&fit=crop&w=900&q=80",
  },
];

export default function AdminDashboardPage() {
  // 프로토타입 시연 편의를 위해 기본 인증 완료 상태로 시작하되, PIN 잠금화면도 체험 가능
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [pinInput, setPinInput] = useState("1234");
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [aggregations, setAggregations] = useState<ProductAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 대시보드 필터 및 검색
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilterStatus>("ALL");
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);

  // 카톡 채팅 자동 파싱 시뮬레이터 상태
  const [botSender, setBotSender] = useState("단톡방어르신");
  const [botMessage, setBotMessage] = useState("설향 딸기 2팩\n샤인머스켓 1박스 예약이요");
  const [botReply, setBotReply] = useState<string | null>(null);

  // 과일 30초 등록 폼 상태
  const [prodCategory, setProdCategory] = useState<ProductCategory>("TODAY");
  const [prodName, setProdName] = useState("");
  const [prodUnit, setProdUnit] = useState("500g 1팩");
  const [prodPrice, setProdPrice] = useState("12900");
  const [prodOriginalPrice, setProdOriginalPrice] = useState("15900");
  const [prodOrigin, setProdOrigin] = useState("국산");
  const [prodBrix, setProdBrix] = useState("15 Brix");
  const [prodBadge, setProdBadge] = useState("오늘 경매 1등품");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImage, setProdImage] = useState(
    "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=900&q=80"
  );
  const [prodIsLimited, setProdIsLimited] = useState(true);
  const [prodStock, setProdStock] = useState("30");
  const [prodIsReceived, setProdIsReceived] = useState(true);
  const [isCompressingImg, setIsCompressingImg] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap?admin=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data.settings);
      setProducts(data.products ?? []);
      setOrders(data.orders ?? []);
      setAggregations(data.aggregations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  // PIN 로그인 검증
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_pin", pin: pinInput }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showToast(data.error || "PIN 번호가 일치하지 않습니다.");
      return;
    }
    setIsUnlocked(true);
    showToast("🔓 사장님 관리자 모드로 접속되었습니다.");
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
      showToast("🔄 프로토타입 샘플 데이터가 초기 상태로 복원되었습니다.");
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
    showToast("✅ 주문 상태가 즉시 반영되었습니다.");
  };

  // 과일 상태 원터치 토글 (품절 / 입고완료 / 노출)
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
    showToast(successMsg);
  };

  // 과일 삭제
  const handleDeleteProduct = async (productId: string, name: string) => {
    const res = await fetch(`/api/admin/products?id=${productId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
      setAggregations(data.aggregations);
      showToast(`🗑️ '${name}' 상품이 삭제되었습니다.`);
    }
  };

  // 사진 업로드 및 자동 WebP 압축
  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingImg(true);
    try {
      const compressedDataUrl = await compressImageToWebpDataUrl(file);
      setProdImage(compressedDataUrl);
      showToast("📸 사진이 모바일 최적화(WebP)로 자동 압축되었습니다!");
    } catch {
      showToast("이미지 압축 중 오류가 발생했습니다.");
    } finally {
      setIsCompressingImg(false);
    }
  };

  // 새 과일 30초 등록
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      showToast("과일명을 입력해 주세요.");
      return;
    }
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: prodCategory,
        name: prodName.trim(),
        unit_label: prodUnit.trim(),
        price: Number(prodPrice) || 0,
        original_price: prodOriginalPrice ? Number(prodOriginalPrice) : undefined,
        origin: prodOrigin.trim(),
        brix: prodBrix.trim(),
        badge_text: prodBadge.trim(),
        description:
          prodDesc.trim() ||
          "오늘 새벽 가락시장에서 직접 선별한 고당도 신선 과일입니다.",
        images: [prodImage],
        is_limited: prodIsLimited,
        total_stock: Number(prodStock) || 30,
        remain_stock: Number(prodStock) || 30,
        is_received: prodIsReceived,
        is_visible: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "과일 등록 실패");
      return;
    }

    setProducts(data.products);
    setAggregations(data.aggregations);
    setProdName("");
    setProdDesc("");
    showToast("🍎 새 과일이 등록되어 손님 주문 화면에 즉시 노출됩니다!");
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
      setOrders(data.orders);
      setProducts(data.products);
      setAggregations(data.aggregations);
      showToast("🤖 카톡 채팅이 자동으로 주문 장부에 집계되었습니다!");
    } else {
      showToast("💬 일반 대화로 분류되어 집계에서 제외되었습니다.");
    }
  };

  // 매장 설정 저장
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      showToast("💾 매장 설정 및 오픈카톡 링크가 저장되었습니다!");
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

  // 고객 주문 검색 및 필터링
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderFilter === "WAITING" && o.status !== "RESERVED") return false;
      if (orderFilter === "READY" && o.status !== "READY") return false;
      if (orderFilter === "PICKED_UP" && o.status !== "PICKED_UP") return false;
      if (orderFilter === "UNPAID" && (o.is_paid || o.status === "CANCELED"))
        return false;

      if (orderSearch.trim()) {
        const matchNick = matchesKoreanSearch(o.kakao_nickname, orderSearch);
        const matchPhone = o.customer_phone_last4.includes(orderSearch.trim());
        const matchItem = o.items.some((i) =>
          matchesKoreanSearch(i.product_name, orderSearch)
        );
        return matchNick || matchPhone || matchItem;
      }
      return true;
    });
  }, [orders, orderFilter, orderSearch]);

  const kakaoNoticeText = useMemo(() => {
    if (!settings) return "";
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://fruit-order-platform.vercel.app";
    return formatKakaoNoticeText(settings, products, origin);
  }, [settings, products]);

  // PIN 잠금 화면
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <DemoSwitchBar />
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
                프로토타입 기본 PIN 번호는 <strong>1234</strong> 입니다.
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN 4자리 입력"
              className="w-full text-center text-2xl tracking-widest font-black py-3 rounded-2xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm transition"
            >
              관리자 페이지 입장
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <DemoSwitchBar />

      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-[#191f28] text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* 1. 관리자 헤더 & 핵심 액션 바 */}
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
              <button
                type="button"
                onClick={handleResetDemo}
                title="프로토타입 샘플 데이터를 처음 상태로 되돌립니다"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>데모 초기화</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
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

          {/* 메인 탭 네비게이션 */}
          <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setActiveTab("DASHBOARD")}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "DASHBOARD"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>1. 실시간 주문 집계표</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PRODUCTS")}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "PRODUCTS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <PackagePlus className="w-4 h-4 text-emerald-600" />
              <span>2. 과일 30초 등록/품절</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SETTINGS")}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "SETTINGS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>3. 가게/단톡방 설정</span>
            </button>
          </div>
        </section>

        {/* =====================================================================
            TAB 1: 실시간 자동 집계 대시보드 (품목별 요약표 + 고객별 주문 카드)
           ===================================================================== */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-4">
            {/* ① 품목별 총 주문 수량 & 잔여 재고 요약표 */}
            <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    📊 품목별 총 주문 수량 요약표 (소분·발주용)
                  </h2>
                  <p className="text-xs text-slate-500">
                    단톡방 주문을 일일이 세지 않아도 과일별 총 주문 수량과 남은 재고가
                    자동 계산됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchAdminData()}
                  className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="py-2.5 pr-2">과일 품목명</th>
                      <th className="py-2.5 px-2 text-center">총 주문수량</th>
                      <th className="py-2.5 px-2 text-center">남은 재고</th>
                      <th className="py-2.5 px-2 text-center">매장 입고상태</th>
                      <th className="py-2.5 pl-2 text-right">원터치 제어</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aggregations.map((agg) => {
                      const isSoldOut = agg.is_limited && agg.remain_stock <= 0;
                      return (
                        <tr key={agg.product_id} className="hover:bg-slate-50/80">
                          <td className="py-3 pr-2">
                            <p className="font-extrabold text-slate-900">
                              {agg.product_name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {agg.unit_label} · {formatKRW(agg.price)}
                            </p>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs">
                              총 {agg.ordered_quantity}개 ({agg.order_count}건)
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {agg.is_limited ? (
                              <span
                                className={`font-extrabold ${
                                  isSoldOut ? "text-rose-600" : "text-slate-700"
                                }`}
                              >
                                {isSoldOut
                                  ? "품절 (0개)"
                                  : `${agg.remain_stock} / ${agg.total_stock}개`}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-semibold">
                                무제한(∞)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                void handlePatchProduct(
                                  agg.product_id,
                                  { is_received: !agg.is_received },
                                  `📦 '${agg.product_name}' 입고 상태가 변경되었습니다.`
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                                agg.is_received
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {agg.is_received ? "✅ 입고완료" : "⏳ 입고전(클릭시 완료)"}
                            </button>
                          </td>
                          <td className="py-3 pl-2 text-right">
                            {agg.is_limited && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePatchProduct(
                                    agg.product_id,
                                    {
                                      remain_stock: isSoldOut ? 15 : 0,
                                    },
                                    isSoldOut
                                      ? `🔄 '${agg.product_name}' 재고 15개가 보충되었습니다.`
                                      : `🚫 '${agg.product_name}' 품절 처리되었습니다.`
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                  isSoldOut
                                    ? "bg-emerald-600 text-white"
                                    : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                }`}
                              >
                                {isSoldOut ? "+재고리필" : "원터치 품절"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ② 고객(오픈카톡 닉네임)별 주문 카드 리스트 */}
            <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    👥 고객(오픈카톡 닉네임)별 주문 카드 ({filteredOrders.length}건)
                  </h2>
                  <p className="text-xs text-slate-500">
                    손님이 매장에 오시면 초성(예: ㄱㅇㅅㄹ)으로 검색하고 원터치로
                    결제·수령 완료를 체크하세요.
                  </p>
                </div>
              </div>

              {/* 검색 및 상태 필터 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="닉네임/초성/전화뒷자리/과일명 검색 (예: ㄱㅇㅅㄹ, 1234)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: "ALL", label: "전체" },
                    { id: "WAITING", label: "예약접수" },
                    { id: "READY", label: "입고완료" },
                    { id: "UNPAID", label: "미결제" },
                    { id: "PICKED_UP", label: "수령완료" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setOrderFilter(tab.id as OrderFilterStatus)
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                        orderFilter === tab.id
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주문 카드 목록 */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    주문 내역을 불러오는 중입니다...
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    조건에 해당하는 주문 내역이 없습니다.
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const isCanceled = order.status === "CANCELED";
                    return (
                      <div
                        key={order.id}
                        className={`p-4 rounded-2xl border transition space-y-3 ${
                          isCanceled
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : order.status === "PICKED_UP"
                            ? "bg-slate-50/70 border-slate-200"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-black text-slate-900">
                              {order.kakao_nickname}
                            </span>
                            {order.customer_phone_last4 && (
                              <span className="text-xs font-bold text-slate-400">
                                ({order.customer_phone_last4})
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                order.source === "KAKAO_BOT"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {order.source === "KAKAO_BOT"
                                ? "🤖 카톡채팅 자동인식"
                                : "📱 모바일웹 주문"}
                            </span>
                            {order.status === "RESERVED" && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                                ⏳ 예약접수
                              </span>
                            )}
                            {order.status === "READY" && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold">
                                ✅ 매장입고·포장완료
                              </span>
                            )}
                            {order.status === "PICKED_UP" && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold">
                                🎁 픽업(수령) 완료
                              </span>
                            )}
                            {order.status === "CANCELED" && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold">
                                취소됨 (재고복구됨)
                              </span>
                            )}
                          </div>

                          <span className="text-base font-black text-emerald-700">
                            {formatKRW(order.total_amount)}
                          </span>
                        </div>

                        {/* 주문 상세 과일 품목 */}
                        <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between font-medium text-slate-800"
                            >
                              <span>
                                • {item.product_name} ({item.unit_label}){" "}
                                <strong className="text-emerald-700 font-extrabold">
                                  x {item.quantity}개
                                </strong>
                              </span>
                              <span className="text-slate-600">
                                {formatKRW(item.subtotal)}
                              </span>
                            </div>
                          ))}
                          <div className="pt-1.5 mt-1.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>⏰ 픽업예정: {order.pickup_time || "미지정"}</span>
                            {order.memo && (
                              <span className="text-amber-800 font-semibold">
                                📝 메모: {order.memo}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 사장님 원터치 상태 변경 버튼 그룹 */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateOrder(order.id, {
                                is_paid: !order.is_paid,
                              })
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              order.is_paid
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>
                              {order.is_paid ? "결제확인 완료" : "결제확인 체크"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateOrder(order.id, { status: "READY" })
                            }
                            disabled={order.status === "READY" || isCanceled}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              order.status === "READY"
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                            }`}
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>입고·준비완료</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateOrder(order.id, {
                                status: "PICKED_UP",
                              })
                            }
                            disabled={order.status === "PICKED_UP" || isCanceled}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              order.status === "PICKED_UP"
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-40"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>픽업(수령) 완료</span>
                          </button>

                          {!isCanceled ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateOrder(order.id, {
                                  status: "CANCELED",
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 ml-auto"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>주문취소</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateOrder(order.id, {
                                  status: "RESERVED",
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 ml-auto"
                            >
                              <span>주문복구</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ③ 오픈카톡 채팅 자동인식 시뮬레이터 (Phase 2 확장 기능 체험) */}
            <section className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold">
                  [고도화 기능 시연] 단톡방 일반 채팅 주문 자동인식 테스트
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                웹 링크에 들어오지 않고 단톡방에 직접{" "}
                <strong>&quot;설향 딸기 2팩, 샤인머스켓 1박스요&quot;</strong>라고
                채팅만 치는 어르신 손님의 메시지도 서버가 자동으로 분석해 위 장부에
                합산할 수 있습니다.
              </p>

              <form
                onSubmit={handleSimulateKakaoBot}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <input
                  type="text"
                  value={botSender}
                  onChange={(e) => setBotSender(e.target.value)}
                  placeholder="카톡방 닉네임"
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
                />
                <input
                  type="text"
                  value={botMessage}
                  onChange={(e) => setBotMessage(e.target.value)}
                  placeholder="예: 설향 딸기 2팩 샤인머스켓 1박스"
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
                <button
                  type="submit"
                  className="sm:col-span-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs transition"
                >
                  🤖 단톡방 채팅 전송 시뮬레이션 (즉시 위 장부에 합산됨)
                </button>
              </form>

              {botReply && (
                <div className="p-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-xs text-emerald-300 whitespace-pre-wrap">
                  {botReply}
                </div>
              )}
            </section>
          </div>
        )}

        {/* =====================================================================
            TAB 2: 오늘의 과일 30초 등록 및 원터치 품절/재고 관리
           ===================================================================== */}
        {activeTab === "PRODUCTS" && (
          <div className="space-y-4">
            {/* 과일 30초 등록 폼 */}
            <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  🍓 오늘의 과일 30초 간편 등록
                </h2>
                <p className="text-xs text-slate-500">
                  자주 파는 과일 버튼을 누르면 정보가 자동 입력되어 가격과 수량만
                  바꾸면 끝납니다.
                </p>
              </div>

              {/* 자주 파는 과일 원터치 프리셋 */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  자주 파는 과일 원터치 불러오기:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_FRUIT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setProdName(preset.name);
                        setProdUnit(preset.unit_label);
                        setProdPrice(String(preset.price));
                        setProdOriginalPrice(String(preset.original_price));
                        setProdOrigin(preset.origin);
                        setProdBrix(preset.brix);
                        setProdBadge(preset.badge_text);
                        setProdDesc(preset.description);
                        setProdImage(preset.image);
                        showToast(
                          `✨ '${preset.name}' 정보를 불러왔습니다. 수량/가격만 확인 후 등록하세요!`
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      판매 탭 구분
                    </label>
                    <select
                      value={prodCategory}
                      onChange={(e) =>
                        setProdCategory(e.target.value as ProductCategory)
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
                    >
                      <option value="TODAY">🍓 오늘의 과일</option>
                      <option value="RESERVE">📦 내일 예약 상품</option>
                      <option value="GIFT_SET">🎁 특가 묶음세트</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      과일 상품명 *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="예: 논산 설향 딸기 (특품)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      판매 단위
                    </label>
                    <input
                      type="text"
                      value={prodUnit}
                      onChange={(e) => setProdUnit(e.target.value)}
                      placeholder="예: 500g 1팩"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      판매 가격(원) *
                    </label>
                    <input
                      type="number"
                      required
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-extrabold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      할인전 원가(선택)
                    </label>
                    <input
                      type="number"
                      value={prodOriginalPrice}
                      onChange={(e) => setProdOriginalPrice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      당도 / 산지
                    </label>
                    <input
                      type="text"
                      value={prodBrix}
                      onChange={(e) => setProdBrix(e.target.value)}
                      placeholder="예: 15 Brix"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs"
                    />
                  </div>
                </div>

                {/* 사진 촬영/업로드 + 한정 수량 설정 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
                    <img
                      src={prodImage}
                      alt="미리보기"
                      className="w-16 h-16 rounded-xl object-cover bg-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800">
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {isCompressingImg
                            ? "WebP 압축 중..."
                            : "스마트폰 사진 촬영/선택"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400 truncate">
                        업로드 시 자동으로 초경량 WebP로 압축됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodIsLimited}
                          onChange={(e) => setProdIsLimited(e.target.checked)}
                          className="rounded text-emerald-600"
                        />
                        <span>🔥 한정 수량 판매 (자동 재고차감)</span>
                      </label>
                      {prodIsLimited && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={prodStock}
                            onChange={(e) => setProdStock(e.target.value)}
                            className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-center"
                          />
                          <span className="text-xs font-bold">개</span>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodIsReceived}
                        onChange={(e) => setProdIsReceived(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>✅ 현재 매장 입고완료 상태</span>
                    </label>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="사장님 한줄 설명 (예: 오늘 경매 1등품! 과즙이 끝내줍니다)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-sm transition"
                >
                  + 오늘의 판매 과일로 즉시 등록하기
                </button>
              </form>
            </section>

            {/* 등록된 과일 관리 리스트 */}
            <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">
                📦 현재 등록된 과일 목록 ({products.length}종)
              </h3>
              <div className="space-y-2.5">
                {products.map((p) => {
                  const isSoldOut = p.is_limited && p.remain_stock <= 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                        !p.is_visible
                          ? "bg-slate-50 border-slate-200 opacity-60"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-slate-900 truncate">
                              {p.name}
                            </span>
                            {!p.is_visible && (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                숨김상태
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {p.unit_label} ·{" "}
                            <strong className="text-slate-900">
                              {formatKRW(p.price)}
                            </strong>{" "}
                            ·{" "}
                            {p.is_limited
                              ? `잔여 ${p.remain_stock}/${p.total_stock}개`
                              : "무제한"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            void handlePatchProduct(
                              p.id,
                              { is_received: !p.is_received },
                              "입고 상태가 변경되었습니다."
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                            p.is_received
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {p.is_received ? "✅ 입고완료" : "⏳ 입고전"}
                        </button>

                        {p.is_limited && (
                          <button
                            type="button"
                            onClick={() =>
                              void handlePatchProduct(
                                p.id,
                                { remain_stock: isSoldOut ? p.total_stock : 0 },
                                isSoldOut
                                  ? "재고가 전체 리필되었습니다."
                                  : "품절 처리되었습니다."
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                              isSoldOut
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {isSoldOut ? "재고리필" : "품절처리"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void handlePatchProduct(
                              p.id,
                              { is_visible: !p.is_visible },
                              p.is_visible
                                ? "손님 화면에서 숨김 처리되었습니다."
                                : "손님 화면에 다시 노출됩니다."
                            )
                          }
                          className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                          title="노출/숨김 토글"
                        >
                          {p.is_visible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(p.id, p.name)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* =====================================================================
            TAB 3: 가게 상호명 / 공지사항 / 오픈카톡방 링크 설정
           ===================================================================== */}
        {activeTab === "SETTINGS" && settings && (
          <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                ⚙️ 우리 가게 정보 및 오픈카톡방 연결 설정
              </h2>
              <p className="text-xs text-slate-500">
                지인분의 실제 가게 이름과 오픈카톡 공구방 링크를 넣어 바로 테스트해
                보세요.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3">
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  오픈카톡 단톡방 링크 (주문 완료 후 이동할 주소)
                </label>
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-mono"
                />
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
                  사장님 관리자 PIN 번호
                </label>
                <input
                  type="text"
                  value={settings.admin_pin}
                  onChange={(e) =>
                    setSettings({ ...settings, admin_pin: e.target.value })
                  }
                  className="w-40 px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
              >
                설정 저장하기
              </button>
            </form>
          </section>
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
