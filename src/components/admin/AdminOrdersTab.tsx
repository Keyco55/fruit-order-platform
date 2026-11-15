"use client";

import React, { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { formatKRW, matchesKoreanSearch } from "@/lib/formatters";
import type { QuickOrderFilter } from "@/components/admin/AdminDashboardTab";
import type { Order, OrderStatus } from "@/types/domain";

interface AdminOrdersTabProps {
  orders: Order[];
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  orderFilter: QuickOrderFilter;
  setOrderFilter: (value: QuickOrderFilter) => void;
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
  onUpdateOrder: (
    orderId: string,
    patch: { status?: OrderStatus; is_paid?: boolean }
  ) => Promise<void>;
  botSender: string;
  setBotSender: (value: string) => void;
  botMessage: string;
  setBotMessage: (value: string) => void;
  botReply: string | null;
  onSimulateKakaoBot: (e: React.FormEvent) => Promise<void>;
}

export function AdminOrdersTab({
  orders,
  orderSearch,
  setOrderSearch,
  orderFilter,
  setOrderFilter,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  onUpdateOrder,
  botSender,
  setBotSender,
  botMessage,
  setBotMessage,
  botReply,
  onSimulateKakaoBot,
}: AdminOrdersTabProps) {
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    "ALL" | "PICKUP" | "DELIVERY"
  >("ALL");
  const [showBotTester, setShowBotTester] = useState(false);

  const filterCounts = useMemo(() => {
    const active = orders.filter((o) => o.status !== "CANCELED");
    return {
      ALL: orders.length,
      UNPAID: active.filter((o) => !o.is_paid).length,
      WAITING: active.filter((o) => o.status === "RESERVED").length,
      READY: active.filter((o) => o.status === "READY").length,
      PICKED_UP: active.filter((o) => o.status === "PICKED_UP").length,
      CANCELED: orders.filter((o) => o.status === "CANCELED").length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (fulfillmentFilter !== "ALL" && o.fulfillment_type !== fulfillmentFilter) {
        return false;
      }

      if (orderFilter === "PICKUP" && o.fulfillment_type !== "PICKUP") return false;
      if (orderFilter === "DELIVERY" && o.fulfillment_type !== "DELIVERY")
        return false;
      if (orderFilter === "WAITING" && o.status !== "RESERVED") return false;
      if (orderFilter === "READY" && o.status !== "READY") return false;
      if (orderFilter === "PICKED_UP" && o.status !== "PICKED_UP") return false;
      if (orderFilter === "CANCELED" && o.status !== "CANCELED") return false;
      if (orderFilter === "UNPAID" && (o.is_paid || o.status === "CANCELED"))
        return false;

      if (orderSearch.trim()) {
        const searchTrim = orderSearch.trim();
        const searchDigits = searchTrim.replace(/\D/g, "");
        const matchNick = matchesKoreanSearch(o.kakao_nickname, orderSearch);
        const matchPhone =
          o.customer_phone_last4.includes(searchTrim) ||
          (o.customer_phone ?? "").includes(searchTrim) ||
          (searchDigits.length > 0 &&
            (o.customer_phone ?? "").replace(/\D/g, "").includes(searchDigits));
        const matchItem = o.items.some((i) =>
          matchesKoreanSearch(i.product_name, orderSearch)
        );
        return matchNick || matchPhone || matchItem;
      }

      return true;
    });
  }, [orders, fulfillmentFilter, orderFilter, orderSearch]);

  const formatOrderTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 & 주문 현황 전용 새로고침 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            👥 고객 주문 현황 ({filteredOrders.length}건)
          </h2>
          <p className="text-xs text-slate-500">
            초성(예: ㄱㅇㅅㄹ)·전화번호 뒷4자리로 찾고 원터치로 결제·수령을 처리하세요.
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
            <span>{isRefreshing ? "새로고침 중..." : "주문 새로고침"}</span>
          </button>
        </div>
      </div>

      {/* 검색 + 수령방식 + 상태 필터 */}
      <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="닉네임/초성/전화뒷자리/과일명 검색 (예: ㄱㅇㅅㄹ, 1234)"
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {orderSearch && (
              <button
                type="button"
                onClick={() => setOrderSearch("")}
                aria-label="검색어 지우기"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold shrink-0">
            {[
              { id: "ALL", label: "전체" },
              { id: "PICKUP", label: "🏬 픽업" },
              { id: "DELIVERY", label: "🚚 배송" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setFulfillmentFilter(item.id as "ALL" | "PICKUP" | "DELIVERY")
                }
                className={`px-3 py-1.5 rounded-lg transition ${
                  fulfillmentFilter === item.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 상태별 건수 칩 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: "ALL", label: `전체 ${filterCounts.ALL}` },
            { id: "UNPAID", label: `미결제 ${filterCounts.UNPAID}` },
            { id: "WAITING", label: `예약접수 ${filterCounts.WAITING}` },
            { id: "READY", label: `입고·준비완료 ${filterCounts.READY}` },
            { id: "PICKED_UP", label: `수령완료 ${filterCounts.PICKED_UP}` },
            { id: "CANCELED", label: `취소됨 ${filterCounts.CANCELED}` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOrderFilter(tab.id as QuickOrderFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                orderFilter === tab.id
                  ? "bg-slate-900 text-white"
                  : tab.id === "UNPAID" && filterCounts.UNPAID > 0
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* 고객 주문 카드 리스트 */}
      <section className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            조건에 해당하는 주문 내역이 없습니다.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isCanceled = order.status === "CANCELED";
            return (
              <div
                key={order.id}
                className={`p-4 rounded-3xl border transition space-y-3 ${
                  isCanceled
                    ? "bg-slate-50 border-slate-200 opacity-65"
                    : order.status === "PICKED_UP"
                    ? "bg-slate-50/70 border-slate-200"
                    : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900">
                        {order.kakao_nickname}
                      </span>
                      {order.customer_phone ? (
                        <a
                          href={`tel:${order.customer_phone.replace(/\D/g, "")}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                        >
                          📞 {order.customer_phone}
                        </a>
                      ) : (
                        order.customer_phone_last4 && (
                          <span className="text-xs font-bold text-slate-500">
                            ({order.customer_phone_last4})
                          </span>
                        )
                      )}
                      <span className="text-[11px] font-medium text-slate-400">
                        {order.order_date} {formatOrderTime(order.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                          order.fulfillment_type === "DELIVERY"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {order.fulfillment_type === "DELIVERY" ? "🚚 배송" : "🏬 픽업"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                          order.is_paid
                            ? "bg-blue-600 text-white"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {order.is_paid ? "💳 결제완료" : "미결제"}
                      </span>
                      {order.status === "RESERVED" && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                          ⏳ 예약접수
                        </span>
                      )}
                      {order.status === "READY" && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          ✅ 입고·포장완료
                        </span>
                      )}
                      {order.status === "PICKED_UP" && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold">
                          🎁 수령완료
                        </span>
                      )}
                      {order.status === "CANCELED" && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold">
                          취소됨
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                        {order.source === "KAKAO_BOT" ? "🤖 카톡봇" : "📱 웹주문"}
                      </span>
                    </div>
                  </div>

                  <span className="text-lg font-black text-emerald-700 shrink-0">
                    {formatKRW(order.total_amount)}
                  </span>
                </div>

                {/* 품목 내역 */}
                <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5 text-xs">
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
                      <span className="text-slate-600 font-semibold">
                        {formatKRW(item.subtotal)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1.5 mt-1 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      {order.fulfillment_type === "DELIVERY" &&
                      order.delivery_address
                        ? `📍 배송지: ${order.delivery_address}`
                        : `⏰ 픽업예정: ${order.pickup_time || "미지정"}`}
                    </span>
                    {order.memo && (
                      <span className="text-amber-800 font-semibold">
                        📝 메모: {order.memo}
                      </span>
                    )}
                  </div>
                </div>

                {/* 원터치 상태 처리 버튼 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateOrder(order.id, { is_paid: !order.is_paid })
                    }
                    className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
                      order.is_paid
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{order.is_paid ? "결제확인 완료" : "결제확인 체크"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateOrder(order.id, { status: "READY" })
                    }
                    disabled={order.status === "READY" || isCanceled}
                    className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
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
                      void onUpdateOrder(order.id, { status: "PICKED_UP" })
                    }
                    disabled={order.status === "PICKED_UP" || isCanceled}
                    className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
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
                        void onUpdateOrder(order.id, { status: "CANCELED" })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 ml-auto"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>주문취소</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateOrder(order.id, { status: "RESERVED" })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 ml-auto"
                    >
                      <span>주문복구</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* 접이식 카톡 채팅 자동인식 시뮬레이터 */}
      <section className="bg-slate-900 text-white rounded-3xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBotTester((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/70 transition"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-extrabold">
              오픈카톡 채팅 주문 자동인식 테스트 (시뮬레이터)
            </span>
          </div>
          {showBotTester ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showBotTester && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              단톡방에 직접 <strong>&quot;설향 딸기 2팩, 샤인머스켓 1박스요&quot;</strong>
              라고 입력된 메시지를 자동 파싱해 주문 목록에 추가하는 테스트입니다.
            </p>
            <form
              onSubmit={onSimulateKakaoBot}
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
                🤖 단톡방 채팅 전송 시뮬레이션
              </button>
            </form>
            {botReply && (
              <div className="p-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-xs text-emerald-300 whitespace-pre-wrap">
                {botReply}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
