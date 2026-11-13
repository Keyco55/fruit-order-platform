"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Minus,
  X,
  Copy,
  ExternalLink,
  MessageCircle,
  MapPin,
  CreditCard,
  ChevronRight,
  Flame,
  PackageCheck,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { DemoSwitchBar } from "@/components/DemoSwitchBar";
import {
  formatKRW,
  formatOrderClipboardText,
  matchesKoreanSearch,
} from "@/lib/formatters";
import { copyTextSafe } from "@/lib/clipboard";
import type {
  Order,
  Product,
  ProductCategory,
  StoreSettings,
} from "@/types/domain";

const NICKNAME_STORAGE_KEY = "fruit_order_kakao_nickname_v1";
const PHONE_STORAGE_KEY = "fruit_order_phone_last4_v1";

const SAMPLE_NICKNAMES = ["과일사랑", "홍제동맘", "초코우유", "단골손님김씨"];

type CategoryFilter = "ALL" | ProductCategory;

export default function CustomerOrderPage() {
  const [settings, setSettings] = useState<Omit<StoreSettings, "admin_pin"> | null>(
    null
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 고객 닉네임 및 내 예약 조회 상태
  const [nickname, setNickname] = useState("과일사랑");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [reservationTab, setReservationTab] = useState<"TODAY" | "ALL">("TODAY");
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);

  // 과일 목록 필터 및 검색
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // 장바구니 상태: { [productId]: quantity }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [pickupTime, setPickupTime] = useState("오늘 오후 방문");
  const [orderMemo, setOrderMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 상세 보기 모달 및 완료 모달 상태
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchBootstrap = useCallback(async (targetNick?: string, targetPhone?: string) => {
    try {
      const params = new URLSearchParams();
      if (targetNick && targetNick.trim()) {
        params.set("nickname", targetNick.trim());
      }
      if (targetPhone && targetPhone.trim()) {
        params.set("phoneLast4", targetPhone.trim());
      }
      const res = await fetch(`/api/bootstrap?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data.settings);
      setProducts(data.products ?? []);
      setMyOrders(data.myOrders ?? []);
    } finally {
      setLoading(false);
      setIsSearchingOrders(false);
    }
  }, []);

  useEffect(() => {
    const savedNick =
      typeof window !== "undefined"
        ? localStorage.getItem(NICKNAME_STORAGE_KEY)
        : null;
    const savedPhone =
      typeof window !== "undefined"
        ? localStorage.getItem(PHONE_STORAGE_KEY)
        : null;

    const initialNick = savedNick && savedNick.trim() ? savedNick : "과일사랑";
    const initialPhone = savedPhone ?? "";

    setNickname(initialNick);
    setPhoneLast4(initialPhone);
    void fetchBootstrap(initialNick, initialPhone);
  }, [fetchBootstrap]);

  const handleLookupOrders = async (customNick?: string) => {
    const targetNick = (customNick ?? nickname).trim();
    if (!targetNick) {
      showToast("조회할 오픈카톡 닉네임을 입력해 주세요.");
      return;
    }
    if (customNick !== undefined) {
      setNickname(customNick);
      setPhoneLast4("");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(NICKNAME_STORAGE_KEY, targetNick);
      if (customNick === undefined) {
        localStorage.setItem(PHONE_STORAGE_KEY, phoneLast4.trim());
      }
    }
    setIsSearchingOrders(true);
    await fetchBootstrap(targetNick, customNick !== undefined ? "" : phoneLast4);
  };

  // 장바구니 조작
  const updateCartQty = (product: Product, delta: number) => {
    setCart((prev) => {
      const current = prev[product.id] ?? 0;
      const next = current + delta;
      if (next <= 0) {
        const clone = { ...prev };
        delete clone[product.id];
        return clone;
      }
      if (product.is_limited && next > product.remain_stock) {
        showToast(
          `🔥 '${product.name}' 상품은 현재 최대 ${product.remain_stock}개까지만 주문 가능합니다.`
        );
        return prev;
      }
      return { ...prev, [product.id]: next };
    });
  };

  const handleDirectOrder = (product: Product) => {
    if (product.is_limited && product.remain_stock <= 0) {
      showToast("품절된 과일입니다.");
      return;
    }
    setCart((prev) => ({
      ...prev,
      [product.id]: Math.max(1, prev[product.id] ?? 1),
    }));
    setIsCartModalOpen(true);
  };

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        if (!product || quantity <= 0) return null;
        return {
          product,
          quantity,
          subtotal: product.price * quantity,
        };
      })
      .filter(
        (
          item
        ): item is { product: Product; quantity: number; subtotal: number } =>
          item !== null
      );
  }, [cart, products]);

  const cartTotalCount = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.quantity, 0),
    [cartItems]
  );

  const cartTotalAmount = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.subtotal, 0),
    [cartItems]
  );

  // 주문서 미리보기 텍스트
  const previewClipboardText = useMemo(() => {
    if (cartItems.length === 0) return "";
    const fakeOrder: Order = {
      id: "preview",
      order_date: "",
      kakao_nickname: nickname.trim() || "홍길동",
      customer_phone_last4: phoneLast4.trim(),
      total_amount: cartTotalAmount,
      status: "RESERVED",
      is_paid: false,
      source: "WEB",
      pickup_time: pickupTime,
      memo: orderMemo,
      created_at: "",
      items: cartItems.map((ci, idx) => ({
        id: String(idx),
        order_id: "preview",
        product_id: ci.product.id,
        product_name: ci.product.name,
        unit_label: ci.product.unit_label,
        unit_price: ci.product.price,
        quantity: ci.quantity,
        subtotal: ci.subtotal,
      })),
    };
    return formatOrderClipboardText(fakeOrder);
  }, [cartItems, nickname, phoneLast4, cartTotalAmount, pickupTime, orderMemo]);

  // 주문 전송 및 오픈카톡 복사
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim();
    if (!cleanNick) {
      showToast("오픈카톡방에서 사용하시는 닉네임을 입력해 주세요!");
      return;
    }
    if (cartItems.length === 0) {
      showToast("장바구니가 비어 있습니다.");
      return;
    }

    // 1. 카톡 인앱 브라우저 User Gesture 유지를 위해 클릭 즉시 예상 주문서 복사 선행
    await copyTextSafe(previewClipboardText);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kakao_nickname: cleanNick,
          customer_phone_last4: phoneLast4.trim(),
          pickup_time: pickupTime.trim(),
          memo: orderMemo.trim(),
          source: "WEB",
          items: cartItems.map((ci) => ({
            product_id: ci.product.id,
            quantity: ci.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "주문 접수 중 오류가 발생했습니다.");
        return;
      }

      const createdOrder = data.order as Order;
      const finalText = formatOrderClipboardText(createdOrder);
      await copyTextSafe(finalText);

      if (typeof window !== "undefined") {
        localStorage.setItem(NICKNAME_STORAGE_KEY, cleanNick);
        localStorage.setItem(PHONE_STORAGE_KEY, phoneLast4.trim());
      }

      setProducts(data.products ?? []);
      setMyOrders(data.myOrders ?? []);
      setCart({});
      setOrderMemo("");
      setIsCartModalOpen(false);
      setCompletedOrder(createdOrder);
      showToast("✅ 주문이 자동 집계되었고 클립보드에 주문서가 복사되었습니다!");
    } catch {
      showToast("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 필터링된 과일 목록
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        return (
          matchesKoreanSearch(p.name, searchQuery) ||
          matchesKoreanSearch(p.origin, searchQuery) ||
          matchesKoreanSearch(p.description, searchQuery)
        );
      }
      return true;
    });
  }, [products, categoryFilter, searchQuery]);

  // 내 예약 필터링
  const filteredMyOrders = useMemo(() => {
    const active = myOrders.filter((o) => o.status !== "CANCELED");
    if (reservationTab === "TODAY") {
      return active.filter((o) => o.status !== "PICKED_UP");
    }
    return myOrders;
  }, [myOrders, reservationTab]);

  return (
    <div className="min-h-screen pb-28">
      <DemoSwitchBar />

      {/* 상단 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-[#191f28] text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* 1. 매장 상단 헤더 & 공지 배너 */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{settings?.subtitle || "매일 새벽 경매 직송 신선 과일"}</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {settings?.store_name || "우리동네 과일가게"}
              </h1>
            </div>

            {settings?.kakao_openchat_url && (
              <a
                href={settings.kakao_openchat_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#FEE500] text-[#191919] text-xs font-bold shadow-xs hover:brightness-95 transition shrink-0"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>단톡방 입장</span>
              </a>
            )}
          </div>

          <div className="mt-3.5 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-950 space-y-1.5">
            <p className="font-semibold leading-relaxed">
              {settings?.notice_text ||
                "🍓 장바구니에 과일을 담고 [주문 전송]을 누르면 예약이 자동 집계되며 오픈카톡 주문서가 복사됩니다."}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-800 pt-1 border-t border-amber-200/60">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {settings?.pickup_guide}
              </span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                {settings?.bank_account}
              </span>
            </div>
          </div>
        </section>

        {/* 2. 내 예약/주문 내역 실시간 조회 */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                내 예약 · 입고 현황 실시간 확인
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleLookupOrders()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSearchingOrders ? "animate-spin" : ""}`}
              />
              <span>새로고침</span>
            </button>
          </div>

          {/* 닉네임 검색 바 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLookupOrders();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="오픈카톡 닉네임 입력 (예: 과일사랑)"
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition shrink-0"
            >
              내 예약 조회
            </button>
          </form>

          {/* 프로토타입 체험용 샘플 닉네임 빠른 선택 */}
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400">
              💡 체험용 손님 클릭:
            </span>
            {SAMPLE_NICKNAMES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void handleLookupOrders(sample)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  nickname === sample
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sample}
              </button>
            ))}
          </div>

          {/* 오늘 수령 예정 / 전체 예약 탭 */}
          <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setReservationTab("TODAY")}
              className={`flex-1 py-2 rounded-lg transition ${
                reservationTab === "TODAY"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500"
              }`}
            >
              🎁 수령 예정 상품 (
              {
                myOrders.filter(
                  (o) => o.status !== "CANCELED" && o.status !== "PICKED_UP"
                ).length
              }
              )
            </button>
            <button
              type="button"
              onClick={() => setReservationTab("ALL")}
              className={`flex-1 py-2 rounded-lg transition ${
                reservationTab === "ALL"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500"
              }`}
            >
              📦 전체 주문 내역 ({myOrders.length})
            </button>
          </div>

          {/* 내 주문 리스트 */}
          <div className="mt-3 space-y-2.5">
            {filteredMyOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                {nickname
                  ? `'${nickname}' 닉네임으로 조회된 수령 대기 예약이 없습니다.`
                  : "오픈카톡 닉네임을 입력하면 내 과일 입고 상태를 바로 확인할 수 있어요."}
              </div>
            ) : (
              filteredMyOrders.map((order) => {
                const allReceived = order.items.every((i) => i.is_received !== false);
                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900">
                          {order.kakao_nickname}님 예약
                        </span>
                        {order.status === "PICKED_UP" ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold">
                            수령완료
                          </span>
                        ) : order.status === "CANCELED" ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold">
                            주문취소
                          </span>
                        ) : order.status === "READY" || allReceived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            <PackageCheck className="w-3 h-3" />✅ 입고완료 (픽업가능)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                            <Clock className="w-3 h-3" />⏳ 매장 준비중
                          </span>
                        )}

                        {order.is_paid && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
                            💳 결제확인됨
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const txt = formatOrderClipboardText(order);
                          await copyTextSafe(txt);
                          showToast("📋 주문서 텍스트가 다시 복사되었습니다!");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        <Copy className="w-3 h-3" />
                        <span>주문서 복사</span>
                      </button>
                    </div>

                    <ul className="text-xs text-slate-700 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>
                              • {item.product_name} ({item.unit_label})
                            </span>
                            <strong className="text-emerald-700">
                              x {item.quantity}
                            </strong>
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatKRW(item.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        픽업: {order.pickup_time || "매장 방문"}
                      </span>
                      <span className="font-extrabold text-slate-900">
                        합계 {formatKRW(order.total_amount)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 3. 카테고리 탭 & 과일 검색 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "ALL", label: "전체 과일" },
              { id: "TODAY", label: "🍓 오늘의 과일" },
              { id: "RESERVE", label: "📦 내일 예약 특가" },
              { id: "GIFT_SET", label: "🎁 단톡방 묶음세트" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as CategoryFilter)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition shadow-2xs ${
                  categoryFilter === tab.id
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="과일 이름이나 초성 검색 (예: 딸기, ㅅㅇㅁㅅㅋ)"
              className="w-full pl-10 pr-9 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* 4. 과일 상품 카드 리스트 */}
        <section className="space-y-3.5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400 bg-white rounded-3xl">
              오늘의 신선한 과일 목록을 불러오는 중입니다...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 bg-white rounded-3xl">
              조건에 맞는 과일이 없습니다.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSoldOut = product.is_limited && product.remain_stock <= 0;
              const inCartQty = cart[product.id] ?? 0;

              return (
                <article
                  key={product.id}
                  className={`bg-white rounded-3xl p-4 shadow-xs border transition ${
                    inCartQty > 0
                      ? "border-emerald-500 ring-1 ring-emerald-500/30"
                      : "border-slate-100"
                  } ${isSoldOut ? "opacity-75" : ""}`}
                >
                  <div className="flex gap-3.5">
                    {/* 상품 썸네일 */}
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="relative w-28 h-28 rounded-2xl overflow-hidden bg-slate-100 shrink-0 group"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-xs font-extrabold px-2.5 py-1 rounded-full border border-white/40">
                            품절 Sold Out
                          </span>
                        </div>
                      )}
                      {product.brix && !isSoldOut && (
                        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                          🍯 {product.brix}
                        </span>
                      )}
                    </button>

                    {/* 상품 핵심 정보 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {product.badge_text && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
                              {product.badge_text}
                            </span>
                          )}
                          {product.is_received ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                              ✅ 매장입고완료
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold">
                              ⏳ 내일입고예약
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="text-left group"
                        >
                          <h3 className="text-base font-extrabold text-slate-900 leading-snug group-hover:text-emerald-700 transition">
                            {product.name}
                          </h3>
                        </button>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {product.unit_label} · 산지: {product.origin}
                        </p>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <div>
                          {product.original_price &&
                            product.original_price > product.price && (
                              <span className="block text-[11px] text-slate-400 line-through">
                                {formatKRW(product.original_price)}
                              </span>
                            )}
                          <span className="text-lg font-black text-slate-900">
                            {formatKRW(product.price)}
                          </span>
                        </div>

                        {/* 실시간 재고 배지 */}
                        {isSoldOut ? (
                          <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">
                            오늘 준비수량 마감
                          </span>
                        ) : product.is_limited ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold">
                            <Flame className="w-3 h-3 fill-current" />
                            잔여 {product.remain_stock}개
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            상시 구매가능
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 상세 코멘트 및 담기 버튼 영역 */}
                  <p className="mt-2.5 text-xs text-slate-600 line-clamp-2 bg-slate-50 px-3 py-2 rounded-xl">
                    {product.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-2"
                    >
                      <span>상세/당도 보기</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {isSoldOut ? (
                      <button
                        type="button"
                        disabled
                        className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed"
                      >
                        품절되었습니다
                      </button>
                    ) : inCartQty > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(product, -1)}
                            aria-label={`${product.name} 수량 감소`}
                            className="w-7 h-7 rounded-lg bg-white text-emerald-700 flex items-center justify-center shadow-2xs hover:bg-emerald-100"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-extrabold text-emerald-900">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(product, 1)}
                            aria-label={`${product.name} 수량 증가`}
                            className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs hover:bg-emerald-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCartModalOpen(true)}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                        >
                          주문하기
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDirectOrder(product)}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition"
                        >
                          바로 주문
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateCartQty(product, 1);
                            showToast(`🛒 '${product.name}' 1개를 장바구니에 담았습니다.`);
                          }}
                          className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 transition shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>장바구니</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      {/* 5. 하단 고정 플로팅 장바구니 바 */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setIsCartModalOpen(true)}
              className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-white text-emerald-700 text-xs font-black flex items-center justify-center">
                  {cartTotalCount}
                </span>
                <span className="text-sm font-extrabold">
                  장바구니 주문서 전송하기
                </span>
              </div>
              <span className="text-base font-black">
                총 {formatKRW(cartTotalAmount)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 6. 상품 상세 팝업 모달 */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[88vh] flex flex-col">
            <div className="relative h-64 bg-slate-100">
              <img
                src={selectedProduct.images[0]}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                  산지: {selectedProduct.origin}
                </span>
                {selectedProduct.brix && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold">
                    당도: {selectedProduct.brix}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-extrabold text-slate-900">
                {selectedProduct.name}
              </h3>
              <p className="text-sm text-slate-500">
                판매단위: {selectedProduct.unit_label}
              </p>
              <p className="text-2xl font-black text-emerald-700">
                {formatKRW(selectedProduct.price)}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl">
                {selectedProduct.description}
              </p>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateCartQty(selectedProduct, 1);
                    setSelectedProduct(null);
                    setIsCartModalOpen(true);
                  }}
                  disabled={
                    selectedProduct.is_limited && selectedProduct.remain_stock <= 0
                  }
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  장바구니 담고 바로 주문하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. 장바구니 & 주문 전송 모달 */}
      {isCartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  장바구니 및 오픈카톡 주문 전송
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitOrder}
              className="p-5 overflow-y-auto space-y-4 flex-1"
            >
              {/* 담긴 과일 리스트 */}
              <div className="space-y-2.5">
                {cartItems.map(({ product, quantity, subtotal }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {product.unit_label} · {formatKRW(product.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCartQty(product, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-extrabold">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(product, 1)}
                        className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[72px]">
                      <span className="text-sm font-extrabold text-slate-900">
                        {formatKRW(subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 주문자 정보 입력 */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    오픈카톡방 닉네임 <span className="text-rose-500">*필수</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="단톡방에서 쓰시는 닉네임을 입력해 주세요"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      전화번호 뒷 4자리 (선택)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={phoneLast4}
                      onChange={(e) =>
                        setPhoneLast4(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="예: 1234 (동명이인 구분)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      픽업 예정 시간
                    </label>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="오늘 오후 방문">오늘 오후 방문</option>
                      <option value="오늘 18시 이후 퇴근길">
                        오늘 18시 이후 퇴근길
                      </option>
                      <option value="내일 오후 방문">내일 오후 방문</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    사장님께 요청사항 (선택)
                  </label>
                  <input
                    type="text"
                    value={orderMemo}
                    onChange={(e) => setOrderMemo(e.target.value)}
                    placeholder="예: 선물용이라 예쁜 걸로 부탁드려요"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 클립보드 자동 복사 미리보기 */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>📋 오픈카톡방 자동 복사 미리보기</span>
                  <span>전송 시 자동 복사됨</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-slate-200 leading-relaxed">
                  {previewClipboardText}
                </pre>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-[#FEE500] hover:brightness-95 text-[#191919] font-black text-base shadow-md flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>
                  {isSubmitting
                    ? "주문 집계 중..."
                    : `주문 전송 및 오픈카톡방 이동 (${formatKRW(cartTotalAmount)})`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. 주문 완료 & 오픈카톡 이동 안내 모달 */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold">
                서버 자동 집계 + 재고 차감 완료
              </span>
              <h3 className="text-xl font-black text-slate-900">
                주문 내역이 복사되었어요!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                사장님 장부(DB)에 이미 안전하게 접수되었습니다.
                <br />
                오픈카톡 공구방에 <strong>[붙여넣기]</strong> 후 전송하시면 예약이
                최종 완료됩니다!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-100 text-left text-xs text-slate-800">
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                {formatOrderClipboardText(completedOrder)}
              </pre>
            </div>

            <div className="space-y-2 pt-1">
              {settings?.kakao_openchat_url && (
                <a
                  href={settings.kakao_openchat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async () => {
                    await copyTextSafe(formatOrderClipboardText(completedOrder));
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#FEE500] text-[#191919] font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:brightness-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>오픈카톡 단톡방 열기 (붙여넣기)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await copyTextSafe(formatOrderClipboardText(completedOrder));
                    showToast("📋 클립보드에 주문서가 다시 복사되었습니다!");
                  }}
                  className="py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 hover:bg-slate-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>주문서 다시 복사</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedOrder(null)}
                  className="py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
                >
                  확인 (창 닫기)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
