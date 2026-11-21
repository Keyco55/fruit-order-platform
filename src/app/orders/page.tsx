"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import Link from "next/link";
import { copyTextSafe } from "@/lib/clipboard";
import { formatKRW, formatOrderClipboardText } from "@/lib/formatters";
import type { Order, StoreSettings } from "@/types/domain";

const NICK_STORAGE_KEY = "customer_nickname_yucheon";
const PHONE_STORAGE_KEY = "customer_phone_yucheon";

export default function CustomerOrdersLookupPage() {
  const [settings, setSettings] = useState<Omit<
    StoreSettings,
    "admin_pin"
  > | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [searchedNick, setSearchedNick] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const lookupId = useRef(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const fetchOrders = useCallback(async (nickname: string, phone: string) => {
    const trimmedNick = nickname.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedNick) {
      alert("오픈카톡 닉네임을 입력해 주세요.");
      return;
    }
    if (!trimmedPhone) {
      alert(
        "주문 시 입력하신 연락처(휴대폰 번호 또는 뒷 4자리)를 입력해 주세요.",
      );
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(NICK_STORAGE_KEY, trimmedNick);
      localStorage.setItem(PHONE_STORAGE_KEY, trimmedPhone);
    }

    const requestId = ++lookupId.current;
    setOrders([]);
    setLoading(true);
    setLookupError(null);
    setSearchedNick(trimmedNick);
    setSearchedPhone(trimmedPhone);

    try {
      const res = await fetch(
        `/api/bootstrap?nickname=${encodeURIComponent(
          trimmedNick,
        )}&phone=${encodeURIComponent(trimmedPhone)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (requestId !== lookupId.current) return;
      if (res.ok) {
        setSettings(data.settings);
        setOrders(data.myOrders ?? []);
      } else {
        setOrders([]);
        setLookupError(
          "예약 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } catch {
      if (requestId !== lookupId.current) return;
      setOrders([]);
      setLookupError("네트워크 오류로 예약 내역을 조회하지 못했습니다.");
    } finally {
      if (requestId === lookupId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      const savedNick =
        typeof window !== "undefined"
          ? localStorage.getItem(NICK_STORAGE_KEY) || ""
          : "";
      const savedPhone =
        typeof window !== "undefined"
          ? localStorage.getItem(PHONE_STORAGE_KEY) || ""
          : "";

      if (savedNick) setNickInput(savedNick);
      if (savedPhone) setPhoneInput(savedPhone);

      if (savedNick && savedPhone) {
        await fetchOrders(savedNick, savedPhone);
      } else {
        const res = await fetch("/api/bootstrap", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
        }
      }
    };
    void loadInitial();
  }, [fetchOrders]);

  const displayedOrders = useMemo(() => {
    if (activeTab === "ACTIVE") {
      return orders.filter(
        (o) => o.status !== "CANCELED" && o.status !== "PICKED_UP",
      );
    }
    return orders;
  }, [orders, activeTab]);

  const activeTotalAmount = useMemo(() => {
    return displayedOrders
      .filter((o) => o.status !== "CANCELED")
      .reduce((sum, o) => sum + o.total_amount, 0);
  }, [displayedOrders]);

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#191F28] font-sans antialiased pb-20">
      {/* 상단 Toss 다크 헤더 */}
      <header className="sticky top-0 z-40 bg-[#191F28] text-white h-14 flex items-center shadow-xs">
        <div className="w-[95%] max-w-[800px] mx-auto px-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-xs font-bold text-white shrink-0 transition"
            >
              ← 과일 보기
            </Link>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white m-0 truncate">
              {settings?.store_name || "후르츠파머 유천점"}
            </h1>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white/80 shrink-0">
            구매 및 예약확인
          </span>
        </div>
      </header>

      <main className="w-[95%] max-w-[800px] mx-auto my-4 px-2 space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="rounded-xl bg-white border px-3 py-2 font-bold"
            disabled={loading}
            onClick={() => void fetchOrders(nickInput, phoneInput)}
          >
            예약 새로고침
          </button>
          <button
            type="button"
            className="rounded-xl bg-white border px-3 py-2"
            onClick={() => {
              lookupId.current++;
              setLoading(false);
              setOrders([]);
              setNickInput("");
              setPhoneInput("");
              setSearchedNick("");
              setSearchedPhone("");
              setLookupError(null);
              localStorage.removeItem(NICK_STORAGE_KEY);
              localStorage.removeItem(PHONE_STORAGE_KEY);
            }}
          >
            내 정보 지우기
          </button>
          <span className="text-[#8B95A1]">
            공용 기기에서는 조회 후 내 정보를 지워 주세요.
          </span>
        </div>
        {/* 브랜드 로고 미니 배너 */}
        <section className="bg-white rounded-2xl border border-[#E5E8EB] p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/images/fruit-farmer-thumb.jpg"
              alt="후르츠파머 유천점"
              className="w-12 h-12 rounded-xl object-contain border border-[#E5E8EB] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm text-[#191F28] truncate">
                {settings?.store_name || "후르츠파머 유천점"} 내 예약 조회
              </div>
              <div className="text-xs text-[#8B95A1] truncate">
                주문 시 입력한 닉네임과 연락처로 구매·예약 상세를 확인할 수
                있습니다.
              </div>
            </div>
          </div>

          {settings?.kakao_openchat_url && (
            <a
              href={settings.kakao_openchat_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-[#FEE500] text-[#191919] text-xs font-extrabold shrink-0 hover:brightness-95 transition"
            >
              공구방 이동
            </a>
          )}
        </section>

        {/* 닉네임 검색 영역 */}
        <section className="bg-white rounded-2xl border border-[#E5E8EB] p-4 shadow-xs space-y-3">
          <div className="text-base font-bold text-[#191F28]">
            내 구매 / 예약 내역 조회
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fetchOrders(nickInput, phoneInput);
            }}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"
          >
            <label htmlFor="orders-page-input-1" className="sr-only">
              오픈카톡 닉네임
            </label>
            <input
              id="orders-page-input-1"
              type="text"
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              placeholder="오픈카톡 닉네임"
              className="w-full min-w-0 p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm sm:text-base bg-white text-[#191F28] outline-none focus:border-[#0064FF] transition"
            />
            <label htmlFor="orders-page-input-2" className="sr-only">
              연락처 (010-0000-0000 또는 뒷4자리)
            </label>
            <input
              id="orders-page-input-2"
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="연락처 (010-0000-0000 또는 뒷4자리)"
              className="w-full min-w-0 p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm sm:text-base bg-white text-[#191F28] outline-none focus:border-[#0064FF] transition"
            />
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-[#4F92F8] hover:bg-[#3E82EB] text-white font-bold text-sm shrink-0 transition"
            >
              조회하기
            </button>
          </form>

          {searchedNick && (
            <div className="pt-2 border-t border-[#E5E8EB] flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-[#8B95A1]">
                조회 정보:{" "}
                <strong className="text-[#191F28]">
                  {searchedNick}
                  {searchedPhone ? ` · ${searchedPhone}` : ""}
                </strong>
              </span>
              <div className="flex gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("ACTIVE")}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeTab === "ACTIVE"
                      ? "bg-[#4F92F8] text-white"
                      : "bg-[#F2F4F6] text-[#191F28]"
                  }`}
                >
                  진행 중 (
                  {
                    orders.filter(
                      (o) =>
                        o.status !== "CANCELED" && o.status !== "PICKED_UP",
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeTab === "ALL"
                      ? "bg-[#4F92F8] text-white"
                      : "bg-[#F2F4F6] text-[#191F28]"
                  }`}
                >
                  전체 내역 ({orders.length})
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 조회 결과 리스트 */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] py-12 text-center text-sm text-[#8B95A1]">
            예약 내역을 조회하는 중입니다...
          </div>
        ) : lookupError ? (
          <div className="bg-white rounded-2xl border border-rose-200 py-10 text-center space-y-3 px-4">
            <div className="text-sm font-semibold text-[#F04452]">
              {lookupError}
            </div>
            <button
              type="button"
              onClick={() => void fetchOrders(searchedNick, searchedPhone)}
              className="inline-block px-4 py-2 rounded-xl bg-[#4F92F8] text-white text-xs font-bold"
            >
              다시 조회하기
            </button>
          </div>
        ) : !searchedNick ? (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] py-12 text-center space-y-3 px-4">
            <div className="text-sm text-[#8B95A1]">
              위 입력창에 주문 시 입력한 닉네임과 연락처를 입력하고 조회해
              주세요.
            </div>
            <Link
              href="/"
              className="inline-block px-4 py-2.5 rounded-xl bg-[#E8F3FF] text-[#1B64DA] text-xs font-bold"
            >
              상품 보러 가기 →
            </Link>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] py-12 text-center space-y-3 px-4">
            <div className="text-sm text-[#8B95A1]">
              &apos;{searchedNick}&apos;
              {searchedPhone ? ` / '${searchedPhone}'` : ""} 조건으로 조회된
              주문 내역이 없습니다.
            </div>
            <Link
              href="/"
              className="inline-block px-4 py-2.5 rounded-xl bg-[#4F92F8] text-white text-xs font-bold"
            >
              과일 주문하러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedOrders.map((order) => (
              <article
                key={order.id}
                className="bg-white rounded-2xl border border-[#E5E8EB] shadow-xs overflow-hidden"
              >
                <div className="bg-[#F2F4F6] px-4 py-3 border-b border-[#E5E8EB] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-[#191F28]">
                      {order.kakao_nickname}님
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#E8F3FF] text-[#1B64DA]">
                      🏬 매장 픽업
                    </span>
                    {order.status === "PICKED_UP" ? (
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold">
                        수령완료
                      </span>
                    ) : order.status === "CANCELED" ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#FFEBEE] text-[#F04452] text-[11px] font-bold">
                        취소됨
                      </span>
                    ) : order.status === "READY" ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#E8F8F0] text-[#03B26C] text-[11px] font-bold">
                        ✅ 입고·준비완료
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-[#FFF4E5] text-[#FF8A00] text-[11px] font-bold">
                        ⏳ 예약접수
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
                      await copyTextSafe(
                        `주문번호: ${order.id}\n${formatOrderClipboardText(order)}`,
                      );
                      showToast("주문서 내용이 복사되었습니다!");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E8EB] text-[11px] font-bold text-[#191F28] hover:bg-slate-50"
                  >
                    주문서 복사
                  </button>
                </div>

                <div className="px-4 pt-3 text-xs text-[#8B95A1] break-all">
                  주문번호: {order.id} ·{" "}
                  {order.is_paid ? "입금 확인" : "입금 확인 전"}
                </div>
                <div className="divide-y divide-[#E5E8EB] px-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#191F28] truncate">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-[#8B95A1] flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>📅 {order.order_date}</span>
                          {item.is_received ? (
                            <span className="font-bold text-[#03B26C]">
                              ✅ 입고완료
                            </span>
                          ) : (
                            <span className="font-bold text-[#FF8A00]">
                              ⏳ 입고준비중
                            </span>
                          )}
                          <span>단가 {formatKRW(item.unit_price)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-[#0064FF]">
                          x {item.quantity}
                        </div>
                        <div className="text-xs font-semibold text-[#191F28]">
                          {formatKRW(item.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#FFF4E5] px-4 py-3 border-t border-[#E5E8EB] flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-[#8B95A1]">
                    ⏰ {order.pickup_time || "매장 방문"}
                  </span>
                  <span className="font-bold text-sm text-[#FF8A00]">
                    합계: {formatKRW(order.total_amount)}
                  </span>
                </div>
              </article>
            ))}

            {displayedOrders.length > 1 && (
              <div className="bg-white rounded-2xl border border-[#E5E8EB] p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-[#8B95A1]">
                  조회된 유효 주문 총합
                </span>
                <span className="text-lg font-extrabold text-[#0064FF]">
                  {formatKRW(activeTotalAmount)}
                </span>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-[#8B95A1]">
          픽업 준비와 입금 확인은 별도입니다. 변경·취소는 공구방에서 주문번호와
          함께 매장에 문의해 주세요.
        </p>
      </main>

      {toastText && (
        <div className="fixed left-1/2 bottom-10 -translate-x-1/2 z-50 bg-[#191F28]/90 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg text-center whitespace-pre-line">
          {toastText}
        </div>
      )}
    </div>
  );
}
