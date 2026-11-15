"use client";

import React, { useMemo, useState } from "react";
import { RefreshCw, TrendingUp, BarChart2, ArrowRight } from "lucide-react";
import { formatKRW } from "@/lib/formatters";
import type { Order, Product, ProductAggregation } from "@/types/domain";

export type QuickOrderFilter =
  | "ALL"
  | "PICKUP"
  | "DELIVERY"
  | "WAITING"
  | "READY"
  | "PICKED_UP"
  | "UNPAID"
  | "CANCELED";

interface AdminDashboardTabProps {
  aggregations: ProductAggregation[];
  orders: Order[];
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
  onPatchProduct: (
    productId: string,
    patch: Partial<Product>,
    successMsg: string
  ) => Promise<void>;
  onJumpToOrders: (filter: QuickOrderFilter) => void;
}

export function AdminDashboardTab({
  aggregations,
  orders,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  onPatchProduct,
  onJumpToOrders,
}: AdminDashboardTabProps) {
  const [chartMetric, setChartMetric] = useState<"QTY" | "REVENUE">("QTY");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "PICKUP" | "DELIVERY">("ALL");

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "CANCELED"),
    [orders]
  );

  // 주문 진행 및 결제 / 수령 통계
  const breakdown = useMemo(() => {
    const total = activeOrders.length;
    const reserved = activeOrders.filter((o) => o.status === "RESERVED").length;
    const ready = activeOrders.filter((o) => o.status === "READY").length;
    const pickedUp = activeOrders.filter((o) => o.status === "PICKED_UP").length;
    const paid = activeOrders.filter((o) => o.is_paid).length;
    const unpaid = total - paid;
    const pickup = activeOrders.filter((o) => o.fulfillment_type === "PICKUP").length;
    const delivery = activeOrders.filter((o) => o.fulfillment_type === "DELIVERY").length;

    return { total, reserved, ready, pickedUp, paid, unpaid, pickup, delivery };
  }, [activeOrders]);

  // 그래프용 데이터 (판매량 또는 매출 내림차순)
  const chartRows = useMemo(() => {
    const sorted = [...aggregations].sort((a, b) =>
      chartMetric === "QTY"
        ? b.ordered_quantity - a.ordered_quantity
        : b.ordered_amount - a.ordered_amount
    );
    const totalValue = sorted.reduce(
      (sum, item) =>
        sum + (chartMetric === "QTY" ? item.ordered_quantity : item.ordered_amount),
      0
    );
    const maxValue = sorted.reduce((max, item) => {
      const val = chartMetric === "QTY" ? item.ordered_quantity : item.ordered_amount;
      return val > max ? val : max;
    }, 0);

    return { sorted, totalValue, maxValue };
  }, [aggregations, chartMetric]);

  const filteredAggregations = useMemo(() => {
    if (categoryFilter === "ALL") return aggregations;
    return aggregations.filter((a) => a.category === categoryFilter);
  }, [aggregations, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 & 대시보드 전용 새로고침 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            📊 판매 대시보드
          </h2>
          <p className="text-xs text-slate-500">
            품목별 판매량 그래프와 소분·발주 현황을 한눈에 확인하세요.
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
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isRefreshing ? "새로고침 중..." : "대시보드 새로고침"}</span>
          </button>
        </div>
      </div>

      {/* 1. 판매량 / 매출 시각화 그래프 카드 */}
      <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                품목별 판매량 그래프
              </h3>
              <p className="text-[11px] text-slate-500">
                유효 주문 기준 총{" "}
                <strong className="text-slate-800">
                  {chartMetric === "QTY"
                    ? `${chartRows.totalValue}개`
                    : formatKRW(chartRows.totalValue)}
                </strong>
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setChartMetric("QTY")}
              className={`px-3 py-1.5 rounded-lg transition ${
                chartMetric === "QTY"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              판매 수량(개)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("REVENUE")}
              className={`px-3 py-1.5 rounded-lg transition ${
                chartMetric === "REVENUE"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              매출 금액(원)
            </button>
          </div>
        </div>

        {chartRows.sorted.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            등록된 상품이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {chartRows.sorted.map((item, idx) => {
              const value =
                chartMetric === "QTY" ? item.ordered_quantity : item.ordered_amount;
              const widthPct =
                chartRows.maxValue > 0
                  ? Math.max(value > 0 ? 6 : 0, Math.round((value / chartRows.maxValue) * 100))
                  : 0;
              const sharePct =
                chartRows.totalValue > 0
                  ? Math.round((value / chartRows.totalValue) * 100)
                  : 0;

              return (
                <div key={item.product_id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md text-[11px] font-black inline-flex items-center justify-center shrink-0 ${
                          idx === 0 && value > 0
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          item.category === "DELIVERY"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.category === "DELIVERY" ? "배송" : "픽업"}
                      </span>
                      <span className="font-bold text-slate-800 truncate">
                        {item.product_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {item.order_count}건 · {sharePct}%
                      </span>
                      <span className="font-black text-slate-900 min-w-[64px]">
                        {chartMetric === "QTY"
                          ? `${item.ordered_quantity}개`
                          : formatKRW(item.ordered_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0 && value > 0
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : value > 0
                          ? "bg-emerald-400"
                          : "bg-slate-200"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 주문 진행 상태 & 결제/수령 비율 요약 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>주문 처리 단계 비율</span>
            </h3>
            <button
              type="button"
              onClick={() => onJumpToOrders("ALL")}
              className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5"
            >
              <span>주문 전체 보기</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
            {breakdown.total > 0 && (
              <>
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${(breakdown.reserved / breakdown.total) * 100}%` }}
                  title={`예약접수 ${breakdown.reserved}건`}
                />
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${(breakdown.ready / breakdown.total) * 100}%` }}
                  title={`준비완료 ${breakdown.ready}건`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${(breakdown.pickedUp / breakdown.total) * 100}%` }}
                  title={`수령완료 ${breakdown.pickedUp}건`}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
            <button
              type="button"
              onClick={() => onJumpToOrders("WAITING")}
              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold transition"
            >
              예약접수 {breakdown.reserved}건
            </button>
            <button
              type="button"
              onClick={() => onJumpToOrders("READY")}
              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold transition"
            >
              준비완료 {breakdown.ready}건
            </button>
            <button
              type="button"
              onClick={() => onJumpToOrders("PICKED_UP")}
              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold transition"
            >
              수령완료 {breakdown.pickedUp}건
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800">
              결제 확인 · 수령 방식 현황
            </h3>
            {breakdown.unpaid > 0 && (
              <button
                type="button"
                onClick={() => onJumpToOrders("UNPAID")}
                className="text-[11px] font-bold text-rose-600 hover:underline inline-flex items-center gap-0.5"
              >
                <span>미결제 {breakdown.unpaid}건 확인</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-slate-600">
                  결제 완료 ({breakdown.paid}건)
                </span>
                <span className="text-rose-600">
                  미결제 ({breakdown.unpaid}건)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-rose-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{
                    width: `${
                      breakdown.total > 0
                        ? (breakdown.paid / breakdown.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-blue-700">
                  🏬 매장 픽업 ({breakdown.pickup}건)
                </span>
                <span className="text-emerald-700">
                  🚚 배송 ({breakdown.delivery}건)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${
                      breakdown.total > 0
                        ? (breakdown.pickup / breakdown.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 품목별 소분·발주 요약표 */}
      <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              📦 품목별 소분·발주 &amp; 재고 현황
            </h3>
            <p className="text-[11px] text-slate-500">
              입고 상태 변경 및 원터치 품절·리필을 바로 제어할 수 있습니다.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
            {[
              { id: "ALL", label: "전체" },
              { id: "PICKUP", label: "🏬 픽업" },
              { id: "DELIVERY", label: "🚚 배송" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as "ALL" | "PICKUP" | "DELIVERY")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  categoryFilter === tab.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold">
                <th className="py-2.5 pr-2">과일 품목명</th>
                <th className="py-2.5 px-2 text-center">주문 수량</th>
                <th className="py-2.5 px-2 text-center">남은 재고</th>
                <th className="py-2.5 px-2 text-center">매장 입고</th>
                <th className="py-2.5 pl-2 text-right">품절/리필</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAggregations.map((agg) => {
                const isSoldOut = agg.is_limited && agg.remain_stock <= 0;
                return (
                  <tr key={agg.product_id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            agg.category === "DELIVERY"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {agg.category === "DELIVERY" ? "배송" : "픽업"}
                        </span>
                        <p className="font-extrabold text-slate-900">
                          {agg.product_name}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {agg.unit_label} · {formatKRW(agg.price)}
                      </p>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs">
                        {agg.ordered_quantity}개 ({agg.order_count}건)
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
                          void onPatchProduct(
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
                        {agg.is_received ? "✅ 입고완료" : "⏳ 입고전"}
                      </button>
                    </td>
                    <td className="py-3 pl-2 text-right">
                      {agg.is_limited && (
                        <button
                          type="button"
                          onClick={() =>
                            void onPatchProduct(
                              agg.product_id,
                              {
                                remain_stock: isSoldOut
                                  ? Math.max(15, agg.total_stock)
                                  : 0,
                              },
                              isSoldOut
                                ? `🔄 '${agg.product_name}' 재고가 보충되었습니다.`
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
    </div>
  );
}
