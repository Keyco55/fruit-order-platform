"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { SafeImage } from "@/components/SafeImage";
import { getOrderAttempt, ORDER_ATTEMPT_KEY } from "@/lib/order-attempt";
import { useModalAccessibility } from "@/lib/use-modal-accessibility";
import { copyTextSafe } from "@/lib/clipboard";
import {
  formatKRW,
  formatOrderClipboardText,
  formatPaymentMethodLabel,
  matchesKoreanSearch,
} from "@/lib/formatters";
import type { Order, PaymentMethod, Product, StoreSettings } from "@/types/domain";

interface CartItem {
  id: string;
  name: string;
  unit_label: string;
  price: number;
  qty: number;
}

interface OrderSuccessReceipt {
  order: Order;
  clipboardText: string;
  copied: boolean;
}

const NICK_STORAGE_KEY = "customer_nickname_yucheon";
const PHONE_STORAGE_KEY = "customer_phone_yucheon";
const CART_STORAGE_KEY = "customer_cart_yucheon";

const MAX_ORDER_QTY_PER_ITEM = 999;

const PICKUP_TIME_PRESETS = [
  "오늘 오후 (12~17시)",
  "오늘 저녁 (17시 이후)",
  "내일 방문",
] as const;

function OrderCheckoutOptions({
  idPrefix,
  pickupTimeOption,
  setPickupTimeOption,
  customPickupTime,
  setCustomPickupTime,
  paymentMethod,
  setPaymentMethod,
  bankAccount,
  onCopyBankAccount,
}: {
  idPrefix: string;
  pickupTimeOption: string;
  setPickupTimeOption: (value: string) => void;
  customPickupTime: string;
  setCustomPickupTime: (value: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  bankAccount?: string;
  onCopyBankAccount: (account: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs font-bold text-[#191F28] mb-1.5">
          픽업 방문 예정 시간 <span className="text-[#0064FF]">*선택</span>
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {PICKUP_TIME_PRESETS.map((slot) => {
            const active = pickupTimeOption === slot;
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={active}
                onClick={() => setPickupTimeOption(slot)}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition text-center ${
                  active
                    ? "bg-[#E8F3FF] border-[#4F92F8] text-[#1B64DA]"
                    : "bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F9FAFB]"
                }`}
              >
                {slot}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={pickupTimeOption === "CUSTOM"}
            onClick={() => setPickupTimeOption("CUSTOM")}
            className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition text-center ${
              pickupTimeOption === "CUSTOM"
                ? "bg-[#E8F3FF] border-[#4F92F8] text-[#1B64DA]"
                : "bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F9FAFB]"
            }`}
          >
            직접 입력
          </button>
        </div>
        {pickupTimeOption === "CUSTOM" && (
          <div className="mt-2">
            <label htmlFor={`${idPrefix}-custom-pickup`} className="sr-only">
              방문 예정 시간 직접 입력
            </label>
            <input
              id={`${idPrefix}-custom-pickup`}
              type="text"
              maxLength={40}
              value={customPickupTime}
              onChange={(e) => setCustomPickupTime(e.target.value)}
              placeholder="예: 오늘 4시 30분경 방문"
              className="w-full p-2.5 border-[1.5px] border-[#4F92F8] rounded-xl text-xs font-semibold bg-white text-[#191F28] outline-none"
            />
          </div>
        )}
      </div>

      <div>
        <span className="block text-xs font-bold text-[#191F28] mb-1.5">
          결제 방식 <span className="text-[#F04452]">*필수</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={paymentMethod === "BANK_TRANSFER"}
            onClick={() => setPaymentMethod("BANK_TRANSFER")}
            className={`p-2.5 rounded-xl border text-left transition ${
              paymentMethod === "BANK_TRANSFER"
                ? "bg-[#E8F3FF] border-[#4F92F8] text-[#1B64DA]"
                : "bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F9FAFB]"
            }`}
          >
            <div className="text-xs font-extrabold">🏦 계좌입금</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              예약 후 계좌 이체
            </div>
          </button>
          <button
            type="button"
            aria-pressed={paymentMethod === "ONSITE"}
            onClick={() => setPaymentMethod("ONSITE")}
            className={`p-2.5 rounded-xl border text-left transition ${
              paymentMethod === "ONSITE"
                ? "bg-[#E8F8F0] border-[#03B26C] text-[#027A48]"
                : "bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F9FAFB]"
            }`}
          >
            <div className="text-xs font-extrabold">💳 현장결제</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              방문 시 카드·현금
            </div>
          </button>
        </div>
        {paymentMethod === "BANK_TRANSFER" && bankAccount ? (
          <div className="mt-2 px-3 py-2 rounded-xl bg-[#F2F4F6] border border-[#E5E8EB] flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[#4E5968] font-semibold truncate">
              입금계좌: {bankAccount}
            </span>
            <button
              type="button"
              onClick={() => onCopyBankAccount(bankAccount)}
              className="px-2 py-1 rounded-lg bg-white border border-[#E5E8EB] font-bold text-[#191F28] shrink-0"
            >
              복사
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isProductSoldOut(product: Product): boolean {
  return Boolean(
    product.is_sold_out ?? (product.is_limited && product.remain_stock <= 0),
  );
}

function syncCartWithProducts(
  currentCart: CartItem[],
  freshProducts: Product[],
): CartItem[] {
  return currentCart.flatMap((item) => {
    const product = freshProducts.find(
      (p) => p.id === item.id && p.is_visible && !isProductSoldOut(p),
    );
    const qty = product ? Math.min(item.qty, MAX_ORDER_QTY_PER_ITEM) : 0;
    return product && qty > 0
      ? [
          {
            id: product.id,
            name: product.name,
            unit_label: product.unit_label,
            price: product.price,
            qty,
          },
        ]
      : [];
  });
}

export default function CustomerStorePage() {
  const [settings, setSettings] = useState<Omit<
    StoreSettings,
    "admin_pin"
  > | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [noticeExpanded, setNoticeExpanded] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState(false);
  const submittingRef = useRef(false);
  const lookupRequest = useRef(0);

  // 1. 내 예약 검색 상태 (닉네임 + 연락처 공통 동기화)
  const [nickInput, setNickInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("BANK_TRANSFER");
  const [pickupTimeOption, setPickupTimeOption] = useState<string>(
    PICKUP_TIME_PRESETS[0],
  );
  const [customPickupTime, setCustomPickupTime] = useState("");
  const [searchedNick, setSearchedNick] = useState<string | null>(null);
  const [searchedPhone, setSearchedPhone] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resTab, setResTab] = useState<"TODAY" | "ALL">("TODAY");

  // 2. 제품 검색
  const [productSearch, setProductSearch] = useState("");

  // 3. 장바구니 상태 (localStorage 연동)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // 4. 단품 주문 모달 & 접수 완료 상태
  const [orderModalProduct, setOrderModalProduct] = useState<{
    product: Product;
    qty: number;
  } | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessReceipt, setOrderSuccessReceipt] =
    useState<OrderSuccessReceipt | null>(null);

  // 5. 제품 상세(프로모션) 모달 상태
  const [promoProduct, setPromoProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // 6. 토스트 & 입력 포커스 Ref
  const [toastText, setToastText] = useState<string | null>(null);
  const orderNickRef = useRef<HTMLInputElement | null>(null);
  const orderPhoneRef = useRef<HTMLInputElement | null>(null);
  const cartNickRef = useRef<HTMLInputElement | null>(null);
  const cartPhoneRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!res.ok) throw new Error("상품 정보를 불러오지 못했습니다.");
      setLoadError("");
      const data = await res.json();
      const fresh: Product[] = data.products ?? [];
      setSettings(data.settings);
      setProducts(fresh);
      if (
        typeof window !== "undefined" &&
        !localStorage.getItem(ORDER_ATTEMPT_KEY)
      ) {
        setCartItems((prev) => {
          const synced = syncCartWithProducts(prev, fresh);
          if (JSON.stringify(synced) !== JSON.stringify(prev)) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(synced));
            return synced;
          }
          return prev;
        });
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "네트워크를 확인해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReservation = useCallback(
    async (targetNick: string, targetPhone?: string) => {
      const trimmedNick = targetNick.trim();
      const trimmedPhone = (targetPhone ?? "").trim();
      const phoneDigits = trimmedPhone.replace(/\D/g, "");
      if (!trimmedNick) {
        alert("닉네임을 입력해주세요.");
        return;
      }
      if (phoneDigits.length < 4) {
        alert("연락처 뒷 4자리 이상을 입력해주세요.");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(NICK_STORAGE_KEY, trimmedNick);
        localStorage.setItem(PHONE_STORAGE_KEY, trimmedPhone);
      }

      const requestId = ++lookupRequest.current;
      setAllOrders([]);
      setIsSearching(true);
      setLookupError(null);
      setSearchedNick(trimmedNick);
      setSearchedPhone(trimmedPhone);

      try {
        const res = await fetch(
          `/api/orders?nickname=${encodeURIComponent(
            trimmedNick,
          )}&phone=${encodeURIComponent(trimmedPhone)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (requestId !== lookupRequest.current) return;
        if (res.ok) {
          setAllOrders(data.orders ?? []);
        } else {
          const errData = data;
          setAllOrders([]);
          setLookupError(
            errData.error ||
              "예약 내역을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
      } catch {
        if (requestId !== lookupRequest.current) return;
        setAllOrders([]);
        setLookupError("네트워크 오류로 예약 내역을 조회하지 못했습니다.");
      } finally {
        if (requestId === lookupRequest.current) setIsSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchInitialData();

    if (typeof window !== "undefined") {
      setPendingAttempt(!!localStorage.getItem(ORDER_ATTEMPT_KEY));
      const savedNick = localStorage.getItem(NICK_STORAGE_KEY) || "";
      const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY) || "";
      if (savedNick) setNickInput(savedNick);
      if (savedPhone) setPhoneInput(savedPhone);
      if (savedNick && savedPhone) {
        setSearchedNick(savedNick);
        setSearchedPhone(savedPhone);
        void fetchReservation(savedNick, savedPhone);
      }

      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (Array.isArray(parsed)) setCartItems(parsed);
        }
      } catch {
        // ignore
      }
    }
  }, [fetchInitialData, fetchReservation]);

  const handleNicknameChange = (val: string) => {
    setNickInput(val);
    if (typeof window !== "undefined" && val.trim()) {
      localStorage.setItem(NICK_STORAGE_KEY, val.trim());
    }
  };

  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    if (typeof window !== "undefined" && val.trim()) {
      localStorage.setItem(PHONE_STORAGE_KEY, val.trim());
    }
  };

  const updateCartState = useCallback((newItems: CartItem[]) => {
    setCartItems(newItems);
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    }
  }, []);

  // 장바구니 열기
  const openCartModal = async () => {
    await refreshCart();
    setIsCartModalOpen(true);
  };

  // 장바구니 추가
  const addToCart = (product: Product, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();

    if (isProductSoldOut(product)) {
      alert("품절된 상품입니다.");
      return;
    }

    const existingIndex = cartItems.findIndex((c) => c.id === product.id);
    let nextCart: CartItem[];

    if (existingIndex > -1) {
      const existing = cartItems[existingIndex];
      if (existing.qty + 1 > MAX_ORDER_QTY_PER_ITEM) {
        alert("한 번에 주문 가능한 최대 수량을 초과했습니다.");
        return;
      }
      nextCart = cartItems.map((c, i) =>
        i === existingIndex ? { ...c, qty: c.qty + 1 } : c,
      );
    } else {
      nextCart = [
        ...cartItems,
        {
          id: product.id,
          name: product.name,
          unit_label: product.unit_label,
          price: product.price,
          qty: 1,
        },
      ];
    }

    updateCartState(nextCart);
    showToast("장바구니에 담았습니다");
  };

  const changeCartQty = (productId: string, delta: number) => {
    const nextCart = cartItems
      .map((item) => {
        if (item.id === productId) {
          const nextQty = item.qty + delta;
          if (nextQty > MAX_ORDER_QTY_PER_ITEM) {
            alert("한 번에 주문 가능한 최대 수량을 초과했습니다.");
            return item;
          }
          return { ...item, qty: nextQty };
        }
        return item;
      })
      .filter((item) => item.qty > 0);

    updateCartState(nextCart);
  };

  const removeFromCart = (productId: string) => {
    const nextCart = cartItems.filter((i) => i.id !== productId);
    updateCartState(nextCart);
  };

  // 단품 바로 주문 모달 열기
  const openOrderModal = (product: Product, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (isProductSoldOut(product)) {
      alert("품절된 상품입니다.");
      return;
    }
    setOrderModalProduct({
      product,
      qty: 1,
    });
  };

  // 클립보드 주문 텍스트 생성 헬퍼 (픽업 전용)
  const buildClipboardText = (
    nickname: string,
    items: Array<{ name: string; qty: number }>,
  ) => {
    const lines = [
      `[${settings?.store_name || "후르츠파머 유천점"}] 닉네임: ${nickname} (매장 픽업)`,
      ...items.map((item) => `- ${item.name} ${item.qty}개`),
    ];
    return lines.join("\n");
  };

  const refreshCart = async (freshProducts?: Product[]) => {
    try {
      const res = freshProducts
        ? null
        : await fetch("/api/bootstrap", { cache: "no-store" });
      if (res && !res.ok) throw new Error("최신 상품을 확인하지 못했습니다.");
      const fresh: Product[] =
        freshProducts ?? (await res!.json()).products ?? [];
      setProducts(fresh);
      // 접수 결과가 불명확하면 원래 품목을 보존해 같은 요청키로 재시도한다.
      if (localStorage.getItem(ORDER_ATTEMPT_KEY)) return;
      const next = syncCartWithProducts(cartItems, fresh);
      if (JSON.stringify(next) !== JSON.stringify(cartItems)) {
        updateCartState(next);
        showToast("장바구니 가격·판매 상태·수량을 최신 정보로 갱신했습니다.");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "상품 갱신에 실패했습니다.",
      );
    }
  };

  useModalAccessibility(
    orderSuccessReceipt
      ? "receipt"
      : promoProduct
        ? "promo"
        : isCartModalOpen
          ? "cart"
          : orderModalProduct
            ? "single"
            : false,
    () => {
      if (submittingRef.current) return;
      setOrderSuccessReceipt(null);
      setPromoProduct(null);
      setIsCartModalOpen(false);
      setOrderModalProduct(null);
    },
  );

  const submitWebOrder = async (
    cleanNick: string,
    cleanPhone: string,
    orderItems: Array<{ product_id: string; quantity: number }>,
    displayItems: Array<{ name: string; qty: number }>,
    clearCartOnSuccess: boolean,
    resolvedPickupTime: string,
    selectedPaymentMethod: PaymentMethod,
  ): Promise<boolean> => {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setIsSubmittingOrder(true);

    try {
      const payload = {
        kakao_nickname: cleanNick,
        customer_phone: cleanPhone.replace(/\D/g, ""),
        fulfillment_type: "PICKUP" as const,
        delivery_address: "",
        pickup_time: resolvedPickupTime,
        payment_method: selectedPaymentMethod,
        source: "WEB" as const,
        items: orderItems,
      };
      const hadAttempt = !!localStorage.getItem(ORDER_ATTEMPT_KEY);
      const attempt = await getOrderAttempt(payload, localStorage);
      setPendingAttempt(true);
      if (!hadAttempt) {
        try {
          const latest = await fetch("/api/bootstrap", { cache: "no-store" });
          if (!latest.ok)
            throw new Error("최신 가격·재고를 확인하지 못했습니다.");
          const fresh: Product[] = (await latest.json()).products ?? [];
          setProducts(fresh);
          const changed = orderItems.some((i) => {
            const p = fresh.find((p) => p.id === i.product_id);
            const old = clearCartOnSuccess
              ? cartItems.find((p) => p.id === i.product_id)
              : orderModalProduct?.product;
            return (
              !p ||
              !old ||
              p.name !== old.name ||
              p.price !== old.price ||
              !p.is_visible ||
              isProductSoldOut(p)
            );
          });
          if (changed) {
            localStorage.removeItem(ORDER_ATTEMPT_KEY);
            setPendingAttempt(false);
            await refreshCart(fresh);
            if (orderModalProduct) {
              const p = fresh.find(
                (p) => p.id === orderModalProduct.product.id,
              );
              setOrderModalProduct(
                p && p.is_visible && !isProductSoldOut(p)
                  ? {
                      product: p,
                      qty: Math.min(
                        orderModalProduct.qty,
                        MAX_ORDER_QTY_PER_ITEM,
                      ),
                    }
                  : null,
              );
            }
            throw new Error(
              "가격·판매 상태·재고가 변경됐습니다. 최신 내용을 확인하고 다시 접수해 주세요.",
            );
          }
        } catch (err) {
          localStorage.removeItem(ORDER_ATTEMPT_KEY);
          setPendingAttempt(false);
          throw err;
        }
      }
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotency_key: attempt.key }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        alert(
          data.error ||
            "주문 접수에 실패했습니다. 재고나 입력 정보를 확인한 뒤 다시 시도해 주세요.",
        );
        return false;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(NICK_STORAGE_KEY, cleanNick);
        localStorage.setItem(PHONE_STORAGE_KEY, cleanPhone);
      }

      if (data.products) setProducts(data.products);
      if (data.myOrders) {
        setSearchedNick(cleanNick);
        setSearchedPhone(cleanPhone);
        setAllOrders(data.myOrders);
      }

      if (clearCartOnSuccess) {
        updateCartState([]);
      }

      localStorage.removeItem(ORDER_ATTEMPT_KEY);
      setPendingAttempt(false);
      const copyText = `주문번호: ${data.order.id}\n${formatOrderClipboardText(data.order)}`;
      const copied = await copyTextSafe(copyText);

      setOrderSuccessReceipt({
        order: data.order,
        clipboardText: copyText,
        copied,
      });

      if (copied) {
        showToast("예약이 접수되고 주문서가 복사되었습니다!");
      }
      return true;
    } catch (err) {
      alert(
        err instanceof Error && err.message.includes("확인")
          ? err.message
          : "접수 결과를 확인하지 못했습니다. 예약 내역을 확인하거나 같은 내용으로 다시 시도해 주세요. 동일 요청키로 중복 접수를 방지합니다.",
      );
      return false;
    } finally {
      submittingRef.current = false;
      setIsSubmittingOrder(false);
    }
  };

  const resolvePickupTime = (): string | null => {
    if (pickupTimeOption === "CUSTOM") {
      const trimmed = customPickupTime.trim();
      if (!trimmed) {
        alert("방문 예정 시간을 입력하거나 시간대 버튼을 선택해 주세요!");
        return null;
      }
      return trimmed;
    }
    return pickupTimeOption;
  };

  // 단품 주문 접수
  const handleSingleOrderGoToKakao = async () => {
    if (!orderModalProduct || isSubmittingOrder) return;
    const cleanNick = nickInput.trim();
    if (!cleanNick) {
      alert("오픈카톡 닉네임을 입력해 주세요!");
      orderNickRef.current?.focus();
      return;
    }

    const cleanPhone = phoneInput.trim();
    if (cleanPhone.replace(/\D/g, "").length < 9) {
      alert(
        "문제 발생 시 연락드릴 수 있도록 휴대폰 번호를 정확히 입력해 주세요!",
      );
      orderPhoneRef.current?.focus();
      return;
    }

    const resolvedPickupTime = resolvePickupTime();
    if (!resolvedPickupTime) return;

    const { product, qty } = orderModalProduct;
    const ok = await submitWebOrder(
      cleanNick,
      cleanPhone,
      [{ product_id: product.id, quantity: qty }],
      [{ name: product.name, qty }],
      false,
      resolvedPickupTime,
      paymentMethod,
    );
    if (ok) {
      setOrderModalProduct(null);
    }
  };

  // 장바구니 주문 접수
  const handleCartGoToKakao = async () => {
    if (isSubmittingOrder) return;
    if (cartItems.length === 0) {
      alert("장바구니가 비어 있습니다.");
      return;
    }

    const cleanNick = nickInput.trim();
    if (!cleanNick) {
      alert("오픈카톡 닉네임을 입력해 주세요!");
      cartNickRef.current?.focus();
      return;
    }

    const cleanPhone = phoneInput.trim();
    if (cleanPhone.replace(/\D/g, "").length < 9) {
      alert(
        "문제 발생 시 연락드릴 수 있도록 휴대폰 번호를 정확히 입력해 주세요!",
      );
      cartPhoneRef.current?.focus();
      return;
    }

    const resolvedPickupTime = resolvePickupTime();
    if (!resolvedPickupTime) return;

    const ok = await submitWebOrder(
      cleanNick,
      cleanPhone,
      cartItems.map((c) => ({ product_id: c.id, quantity: c.qty })),
      cartItems.map((c) => ({ name: c.name, qty: c.qty })),
      true,
      resolvedPickupTime,
      paymentMethod,
    );
    if (ok) {
      setIsCartModalOpen(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cartTotalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems],
  );
  const cartTotalCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems],
  );

  // 예약 조회 필터 (Asia/Seoul KST 기준)
  const filteredReservations = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const valid = allOrders.filter((o) => o.status !== "CANCELED");

    if (resTab === "TODAY") {
      return valid.filter(
        (o) => o.status !== "PICKED_UP" && o.order_date <= todayStr,
      );
    }
    return valid;
  }, [allOrders, resTab]);

  const totalReservationPrice = useMemo(() => {
    return filteredReservations.reduce((sum, o) => sum + o.total_amount, 0);
  }, [filteredReservations]);

  // 필터링된 상품 목록 (관리자 설정 순서 우선, 매장 픽업 단일)
  const filteredProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((p) => {
        if (productSearch.trim()) {
          return (
            matchesKoreanSearch(p.name, productSearch) ||
            matchesKoreanSearch(p.origin, productSearch) ||
            matchesKoreanSearch(p.description, productSearch)
          );
        }
        return true;
      });
  }, [products, productSearch]);

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#191F28] font-sans antialiased pb-28">
      {/* 1. 상단 Toss 스타일 다크 헤더 */}
      <header className="sticky top-0 z-40 bg-[#191F28] text-white h-14 flex items-center shadow-xs">
        <div className="w-[95%] max-w-[800px] mx-auto px-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white m-0 truncate">
              {settings?.store_name || "후르츠파머 유천점"}
            </h1>
            <span className="inline-block bg-white/10 text-white border border-white/20 rounded-[10px] px-2 py-0.5 text-[11px] font-semibold shrink-0">
              {settings?.branch_code || "유천점"}
            </span>
          </div>

          <Link
            href="/orders"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-white/15 hover:bg-white/25 text-xs font-bold text-white shrink-0 transition"
          >
            <span>구매 및 예약확인</span>
          </Link>
        </div>
      </header>

      {/* 2. 메인 컨테이너 */}
      <main className="w-[95%] max-w-[800px] mx-auto my-4 px-2 box-border space-y-4">
        {/* 상단 매장 대표 이미지(썸네일) 브랜드 배너 */}
        {pendingAttempt && (
          <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm">
            접수 확인이 필요한 주문이 있습니다.{" "}
            <Link className="underline font-bold" href="/orders">
              예약 내역 확인
            </Link>
            <button
              type="button"
              className="block py-2 underline"
              onClick={() => {
                if (
                  confirm(
                    "이전 주문이 미접수인 것을 확인하셨나요? 접수된 주문이 있다면 해제 후 다시 접수하지 마세요.",
                  )
                ) {
                  localStorage.removeItem(ORDER_ATTEMPT_KEY);
                  setPendingAttempt(false);
                }
              }}
            >
              미접수 확인 후 새 시도
            </button>
          </div>
        )}
        {loadError && (
          <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm">
            {loadError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => void fetchInitialData()}
            >
              다시 불러오기
            </button>
          </div>
        )}
        <section className="bg-white rounded-2xl border border-[#E5E8EB] p-3 shadow-xs flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-[#E5E8EB] bg-white shrink-0 flex items-center justify-center">
              <SafeImage
                src="/images/fruit-farmer-thumb.jpg"
                alt="후르츠파머 유천점"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-[#191F28] m-0 truncate">
                {settings?.store_name || "후르츠파머 유천점"}
              </h2>
              <p className="text-xs sm:text-sm text-[#8B95A1] mt-0.5 line-clamp-2">
                {settings?.subtitle || "매일 새벽 경매 1등품 직송 신선 과일"}
              </p>
              <p className="text-[11px] text-[#03B26C] font-semibold mt-1">
                📍 {settings?.pickup_guide || "매장 방문 픽업 안내"}
              </p>
            </div>
          </div>

          {settings?.kakao_openchat_url && (
            <a
              href={settings.kakao_openchat_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl bg-[#FEE500] text-[#191919] text-xs font-extrabold shadow-2xs hover:brightness-95 transition shrink-0"
            >
              💬 공구방
            </a>
          )}
        </section>

        {/* 공지사항 배너 */}
        {settings?.notice_text && (
          <div className="p-3 text-sm rounded-2xl bg-[#FFF4E5] text-[#9A4D00] border border-[#ffe0b0]">
            <p
              className={
                noticeExpanded ? "whitespace-pre-wrap" : "line-clamp-2"
              }
            >
              {settings.notice_text}
            </p>
            <button
              type="button"
              aria-expanded={noticeExpanded}
              className="mt-1 py-1 text-xs font-bold underline"
              onClick={() => setNoticeExpanded((v) => !v)}
            >
              {noticeExpanded ? "공지 접기" : "공지 더 보기"}
            </button>
          </div>
        )}

        {/* -------------------------------------------------------------
            SECTION 1: 내 예약 확인 (인라인 + 상세 페이지 링크)
           ------------------------------------------------------------- */}
        <details className="rounded-xl border border-[#E5E8EB] p-3">
          <summary className="font-bold cursor-pointer py-1">
            내 예약 빠른 조회
          </summary>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[1.15rem] font-bold text-[#191F28]">
              내 예약 확인
            </div>
            <Link
              href="/orders"
              className="text-xs font-bold text-[#0064FF] hover:underline"
            >
              구매 및 예약확인 페이지 →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3">
            <label htmlFor="app-page-input-1" className="sr-only">
              오픈카톡 닉네임
            </label>
            <input
              id="app-page-input-1"
              type="text"
              value={nickInput}
              onChange={(e) => handleNicknameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  void fetchReservation(nickInput, phoneInput);
              }}
              placeholder="오픈카톡 닉네임"
              className="w-full min-w-0 p-3 sm:px-3.5 sm:py-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm sm:text-base bg-white text-[#191F28] outline-none focus:border-[#0064FF] transition"
            />
            <label htmlFor="app-page-input-2" className="sr-only">
              연락처 (010-0000-0000 또는 뒷4자리)
            </label>
            <input
              id="app-page-input-2"
              type="tel"
              value={phoneInput}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  void fetchReservation(nickInput, phoneInput);
              }}
              placeholder="연락처 (010-0000-0000 또는 뒷4자리)"
              className="w-full min-w-0 p-3 sm:px-3.5 sm:py-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm sm:text-base bg-white text-[#191F28] outline-none focus:border-[#0064FF] transition"
            />
            <button
              type="button"
              onClick={() => void fetchReservation(nickInput, phoneInput)}
              className="px-4 py-3 rounded-xl bg-[#4F92F8] hover:bg-[#3E82EB] text-white font-bold text-sm shrink-0 transition"
            >
              조회
            </button>
          </div>

          {/* 예약 조회 결과 영역 */}
          {isSearching ? (
            <div className="text-center py-5 text-sm text-[#8B95A1]">
              조회중...
            </div>
          ) : lookupError ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-4 text-center space-y-2">
              <div className="text-xs font-semibold text-[#F04452]">
                {lookupError}
              </div>
              <button
                type="button"
                onClick={() =>
                  void fetchReservation(
                    searchedNick || nickInput,
                    searchedPhone || phoneInput,
                  )
                }
                className="px-3.5 py-1.5 rounded-xl bg-[#4F92F8] text-white text-xs font-bold"
              >
                다시 조회
              </button>
            </div>
          ) : (
            searchedNick && (
              <div className="bg-white rounded-2xl border border-[#E5E8EB] shadow-xs overflow-hidden">
                <div className="bg-[#F2F4F6] px-4 py-3 border-b border-[#E5E8EB] flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-base text-[#191F28]">
                    {searchedNick}
                    {searchedPhone ? ` (${searchedPhone})` : ""}님의 예약
                  </span>
                  <div className="flex gap-1.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setResTab("TODAY")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        resTab === "TODAY"
                          ? "bg-[#4F92F8] text-white shadow-xs"
                          : "bg-white text-[#191F28] border border-[#E5E8EB]"
                      }`}
                    >
                      수령 예정
                    </button>
                    <button
                      type="button"
                      onClick={() => setResTab("ALL")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        resTab === "ALL"
                          ? "bg-[#4F92F8] text-white shadow-xs"
                          : "bg-white text-[#191F28] border border-[#E5E8EB]"
                      }`}
                    >
                      전체 내역 ({allOrders.length})
                    </button>
                  </div>
                </div>

                {filteredReservations.length === 0 ? (
                  <div className="text-center py-6 text-sm text-[#8B95A1]">
                    예약 내역이 없습니다.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-[#E5E8EB] px-4">
                      {filteredReservations.flatMap((order) =>
                        order.items.map((item) => (
                          <div
                            key={item.id}
                            className="py-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-base text-[#191F28] mb-1 truncate">
                                {item.product_name}
                              </div>
                              <div className="text-xs text-[#8B95A1] flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#1B64DA]">
                                  🏬 매장 픽업
                                </span>
                                <span
                                  className={`font-bold ${
                                    order.payment_method === "ONSITE"
                                      ? "text-[#027A48]"
                                      : "text-[#1B64DA]"
                                  }`}
                                >
                                  {order.payment_method === "ONSITE"
                                    ? "💳 현장결제"
                                    : "🏦 계좌입금"}
                                </span>
                                <span>⏰ {order.pickup_time || "오후 방문"}</span>
                                <span>📅 {order.order_date}</span>
                                {item.is_received ? (
                                  <span className="font-bold text-[#03B26C]">
                                    ✅ 입고완료
                                  </span>
                                ) : (
                                  <span className="font-bold text-[#FF8A00]">
                                    ⏳ 준비중
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-[#0064FF] text-base">
                                x {item.quantity}
                              </span>
                              <div className="text-xs font-semibold text-[#191F28] mt-0.5">
                                {formatKRW(item.subtotal)}
                              </div>
                            </div>
                          </div>
                        )),
                      )}
                    </div>
                    <div className="bg-[#FFF4E5] px-4 py-3.5 text-right font-bold text-[#FF8A00] border-t border-[#E5E8EB] text-base">
                      총 금액: {formatKRW(totalReservationPrice)}
                    </div>
                  </>
                )}
              </div>
            )
          )}
        </details>

        {/* -------------------------------------------------------------
            SECTION 2: 현재 구매 가능 제품 (매장 픽업)
           ------------------------------------------------------------- */}
        <section className="pt-5 border-t border-[#E5E8EB]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[1.15rem] font-bold text-[#191F28]">
              오늘의 픽업 상품 ({filteredProducts.length})
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#E8F3FF] text-[#1B64DA] text-xs font-bold">
              🏬 매장 픽업 전용
            </span>
          </div>

          {/* 제품명 실시간 검색 */}
          <div className="mb-3">
            <label htmlFor="app-page-input-3" className="sr-only">
              제품명 검색
            </label>
            <input
              id="app-page-input-3"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="제품명 검색"
              className="w-full p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-base bg-white text-[#191F28] outline-none focus:border-[#0064FF] transition"
            />
          </div>

          {/* 제품 카드 목록 */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-10 text-sm text-[#8B95A1]">
                로딩중...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-sm text-[#8B95A1] bg-white rounded-2xl border border-[#E5E8EB]">
                현재 등록된 판매 상품이 없습니다.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSoldOut = isProductSoldOut(product);

                return (
                  <article
                    key={product.id}
                    className={`bg-white rounded-2xl border border-[#E5E8EB] shadow-xs overflow-hidden transition ${
                      isSoldOut ? "bg-[#F2F4F6] opacity-80" : ""
                    }`}
                  >
                    {/* 카드 본문 (클릭 시 사진/상세 팝업) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveImageIndex(0);
                        setPromoProduct(product);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveImageIndex(0);
                          setPromoProduct(product);
                        }
                      }}
                      className="p-4 flex items-center gap-3.5 cursor-pointer active:scale-[0.99] transition"
                    >
                      {/* 80x80 이미지 썸네일 */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F2F4F6] border border-[#E5E8EB] shrink-0 flex items-center justify-center">
                        {product.images[0] ? (
                          <SafeImage
                            src={product.images[0]}
                            alt={product.name}
                            className={`w-full h-full object-cover ${
                              isSoldOut ? "grayscale opacity-75" : ""
                            }`}
                          />
                        ) : (
                          <span className="text-xs text-[#B0B8C1]">
                            사진 없음
                          </span>
                        )}
                      </div>

                      {/* 정보 영역 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 bg-[#E8F3FF] text-[#1B64DA]">
                            🏬 픽업
                          </span>
                          <div
                            className={`font-bold text-[1.02rem] line-clamp-2 ${
                              isSoldOut ? "text-[#B0B8C1]" : "text-[#191F28]"
                            }`}
                          >
                            {product.name}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-sm text-[#8B95A1]">
                          <span className="truncate">
                            단위: {product.unit_label}
                          </span>
                          <span className="font-semibold text-[#191F28]">
                            {product.original_price &&
                            product.original_price > product.price ? (
                              <del className="block text-xs text-[#8B95A1]">
                                {formatKRW(product.original_price)}
                              </del>
                            ) : null}
                            가격: {formatKRW(product.price)}
                          </span>
                          <span className="col-span-2 text-xs">
                            판매일 {product.sale_date} ·{" "}
                            {product.is_received
                              ? "입고완료 · 매장 안내에 따라 픽업"
                              : "입고 전 · 픽업 가능 여부 확인"}
                          </span>
                          <span>산지: {product.origin || "국산"}</span>
                          <span>
                            {isSoldOut ? (
                              <strong className="text-[#B0B8C1]">품절</strong>
                            ) : (
                              <strong className="text-[#03B26C]">
                                구매가능
                              </strong>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 하단 2분할 버튼: [주문하기] / [장바구니] */}
                    <div className="flex border-t border-[#E5E8EB]">
                      {isSoldOut ? (
                        <div className="flex-1 py-3 text-center text-sm font-bold text-[#B0B8C1] bg-[#F2F4F6]">
                          품절된 제품입니다
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => openOrderModal(product, e)}
                            className="flex-1 py-3 bg-[#E8F3FF] text-[#1B64DA] font-bold text-sm border-r border-[#E5E8EB] hover:bg-[#d6e9ff] active:bg-[#c6dfff] transition"
                          >
                            주문하기
                          </button>
                          <button
                            type="button"
                            onClick={(e) => addToCart(product, e)}
                            className="flex-1 py-3 bg-[#E8F8F0] text-[#03B26C] font-bold text-sm hover:bg-[#d4f3e4] active:bg-[#c2ebd4] transition"
                          >
                            장바구니
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* -------------------------------------------------------------
          3. 우측 하단 플로팅 버튼 (장바구니 FAB & 상단 이동 FAB)
         ------------------------------------------------------------- */}
      {cartItems.length > 0 && (
        <button
          type="button"
          onClick={openCartModal}
          aria-label="장바구니 열기"
          className="fixed right-5 bottom-20 w-12 h-12 rounded-full bg-[#3FC08E] hover:bg-[#34B07F] text-white flex items-center justify-center shadow-lg z-30 transition transform active:scale-95"
        >
          <span className="text-xl">🛒</span>
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#F06E78] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            {cartTotalCount}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="맨 위로 이동"
        className="fixed right-5 bottom-5 w-12 h-12 rounded-full bg-[#4F92F8] hover:bg-[#3E82EB] text-white font-black text-xl flex items-center justify-center shadow-lg z-30 transition transform active:scale-95"
      >
        ↑
      </button>

      {/* -------------------------------------------------------------
          4. 모달 A: 단품 바로 [주문하기] 모달 (#orderModal)
         ------------------------------------------------------------- */}
      {orderModalProduct && (
        <div
          role="dialog"
          aria-label={
            orderSuccessReceipt
              ? "예약 접수 완료"
              : promoProduct
                ? "상품 상세"
                : isCartModalOpen
                  ? "장바구니 예약"
                  : "단품 예약"
          }
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#191F28]/45 flex items-center justify-center p-4"
          onClick={() => setOrderModalProduct(null)}
        >
          <div
            className="bg-white w-full max-w-[390px] rounded-2xl border border-[#E5E8EB] shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E8EB] shrink-0">
              <h2 className="text-base font-bold text-[#191F28] m-0">
                제품 주문하기
              </h2>
              <button
                type="button"
                onClick={() => setOrderModalProduct(null)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-[#F2F4F6] text-[#8B95A1] text-lg font-bold flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* 주문 품목 & 수량 */}
              <div>
                <div className="text-xs font-semibold text-[#8B95A1] mb-1.5">
                  주문 내용
                </div>
                <div className="bg-[#E8F3FF] border border-[#c9e0ff] rounded-xl p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm sm:text-base text-[#1B64DA] truncate">
                      {orderModalProduct.product.name}
                    </div>
                    <div className="text-xs text-[#1B64DA]/80 mt-0.5">
                      {formatKRW(
                        orderModalProduct.product.price * orderModalProduct.qty,
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOrderModalProduct((prev) =>
                          prev
                            ? { ...prev, qty: Math.max(1, prev.qty - 1) }
                            : null,
                        )
                      }
                      className="w-7 h-7 rounded-lg bg-white text-[#1B64DA] font-bold border border-[#c9e0ff] flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="font-bold text-base min-w-[20px] text-center text-[#1B64DA]">
                      {orderModalProduct.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOrderModalProduct((prev) => {
                          if (!prev) return null;
                          if (prev.qty + 1 > MAX_ORDER_QTY_PER_ITEM) {
                            alert("한 번에 주문 가능한 최대 수량을 초과했습니다.");
                            return prev;
                          }
                          return { ...prev, qty: prev.qty + 1 };
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-white text-[#1B64DA] font-bold border border-[#c9e0ff] flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 닉네임 입력란 */}
              <div>
                <label
                  htmlFor="customer-field-1"
                  className="block text-xs font-bold text-[#191F28] mb-1.5"
                >
                  오픈카톡 닉네임 <span className="text-[#F04452]">*필수</span>
                </label>
                <input
                  id="customer-field-1"
                  ref={orderNickRef}
                  type="text"
                  value={nickInput}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                  placeholder="단톡방 닉네임을 입력해 주세요"
                  className="w-full p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm font-semibold bg-white text-[#191F28] outline-none focus:border-[#0064FF]"
                />
              </div>

              {/* 연락처 입력란 */}
              <div>
                <label
                  htmlFor="customer-field-2"
                  className="block text-xs font-bold text-[#191F28] mb-1.5"
                >
                  연락처 (휴대폰 번호){" "}
                  <span className="text-[#F04452]">*필수</span>
                </label>
                <input
                  id="customer-field-2"
                  ref={orderPhoneRef}
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="예: 010-1234-5678 (예약 확인·긴급 안내용)"
                  className="w-full p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm font-semibold bg-white text-[#191F28] outline-none focus:border-[#0064FF]"
                />
                <p className="text-[11px] text-[#8B95A1] mt-1 m-0">
                  단톡방 메시지에는 노출되지 않으며 매장 확인·예약 조회에만
                  사용됩니다.
                </p>
              </div>

              <OrderCheckoutOptions
                idPrefix="single-order"
                pickupTimeOption={pickupTimeOption}
                setPickupTimeOption={setPickupTimeOption}
                customPickupTime={customPickupTime}
                setCustomPickupTime={setCustomPickupTime}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                bankAccount={settings?.bank_account}
                onCopyBankAccount={async (account) => {
                  if (await copyTextSafe(account)) {
                    showToast("계좌번호가 복사되었습니다!");
                  }
                }}
              />

              <p className="text-xs text-[#8B95A1] text-center leading-relaxed m-0">
                매장 픽업 예약이 먼저 접수된 뒤, 공구방에 붙여넣기할 주문서가
                자동 복사됩니다.
              </p>

              <button
                type="button"
                disabled={isSubmittingOrder}
                onClick={() => void handleSingleOrderGoToKakao()}
                className="w-full py-3.5 rounded-xl bg-[#4F92F8] hover:bg-[#3E82EB] disabled:opacity-60 text-white font-bold text-base shadow-md transition"
              >
                {isSubmittingOrder ? "예약 접수 중..." : "픽업 예약하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          5. 모달 B: [장바구니] 모달 (#cartModal) - 닉네임 + 픽업/배송 포함
         ------------------------------------------------------------- */}
      {isCartModalOpen && (
        <div
          role="dialog"
          aria-label={
            orderSuccessReceipt
              ? "예약 접수 완료"
              : promoProduct
                ? "상품 상세"
                : isCartModalOpen
                  ? "장바구니 예약"
                  : "단품 예약"
          }
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#191F28]/45 flex items-center justify-center p-4"
          onClick={() => setIsCartModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-[400px] rounded-2xl border border-[#E5E8EB] shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E8EB] shrink-0">
              <h2 className="text-base font-bold text-[#191F28] m-0">
                장바구니
              </h2>
              <button
                type="button"
                onClick={() => setIsCartModalOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-[#F2F4F6] text-[#8B95A1] text-lg font-bold flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
              {/* 담긴 상품 목록 */}
              <div className="divide-y divide-[#E5E8EB]">
                {cartItems.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#8B95A1]">
                    장바구니가 비어 있습니다.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#191F28] truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#8B95A1]">
                          {formatKRW(item.price)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeCartQty(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-[#E8F8F0] text-[#03B26C] font-bold border border-[#b8ebd4] flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-bold text-sm min-w-[20px] text-center">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeCartQty(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#E8F8F0] text-[#03B26C] font-bold border border-[#b8ebd4] flex items-center justify-center"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="ml-1 text-xs text-[#F04452] font-semibold px-1"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 닉네임 및 수령 방식 입력 영역 */}
              {cartItems.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-[#E5E8EB]">
                  <div>
                    <label
                      htmlFor="customer-field-3"
                      className="block text-xs font-bold text-[#191F28] mb-1.5"
                    >
                      오픈카톡 닉네임{" "}
                      <span className="text-[#F04452]">*필수</span>
                    </label>
                    <input
                      id="customer-field-3"
                      ref={cartNickRef}
                      type="text"
                      value={nickInput}
                      onChange={(e) => handleNicknameChange(e.target.value)}
                      placeholder="단톡방 닉네임을 입력해 주세요"
                      className="w-full p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm font-semibold bg-white text-[#191F28] outline-none focus:border-[#0064FF]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-field-4"
                      className="block text-xs font-bold text-[#191F28] mb-1.5"
                    >
                      연락처 (휴대폰 번호){" "}
                      <span className="text-[#F04452]">*필수</span>
                    </label>
                    <input
                      id="customer-field-4"
                      ref={cartPhoneRef}
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="예: 010-1234-5678 (예약 확인·긴급 안내용)"
                      className="w-full p-3 border-[1.5px] border-[#E5E8EB] rounded-xl text-sm font-semibold bg-white text-[#191F28] outline-none focus:border-[#0064FF]"
                    />
                    <p className="text-[11px] text-[#8B95A1] mt-1 m-0">
                      단톡방 메시지에는 노출되지 않으며 매장 확인·예약 조회에만
                      사용됩니다.
                    </p>
                  </div>

                  <OrderCheckoutOptions
                    idPrefix="cart-order"
                    pickupTimeOption={pickupTimeOption}
                    setPickupTimeOption={setPickupTimeOption}
                    customPickupTime={customPickupTime}
                    setCustomPickupTime={setCustomPickupTime}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    bankAccount={settings?.bank_account}
                    onCopyBankAccount={async (account) => {
                      if (await copyTextSafe(account)) {
                        showToast("계좌번호가 복사되었습니다!");
                      }
                    }}
                  />

                  <p className="text-xs text-[#8B95A1] text-center leading-relaxed m-0">
                    매장 픽업 예약이 먼저 접수된 뒤, 공구방에 붙여넣기할
                    주문서가 자동 복사됩니다.
                  </p>
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="bg-[#F2F4F6] px-5 py-3 border-t border-[#E5E8EB] flex items-center justify-between font-bold text-sm shrink-0">
                <span>총 금액</span>
                <span className="text-base text-[#0064FF]">
                  {formatKRW(cartTotalAmount)}
                </span>
              </div>
            )}

            <div className="flex gap-2 p-4 border-t border-[#E5E8EB] shrink-0">
              <button
                type="button"
                onClick={() => setIsCartModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#F2F4F6] text-[#191F28] font-bold text-sm hover:bg-[#E5E8EB] transition"
              >
                더 둘러보기
              </button>
              <button
                type="button"
                onClick={() => void handleCartGoToKakao()}
                disabled={cartItems.length === 0 || isSubmittingOrder}
                className="flex-1 py-3 rounded-xl bg-[#3FC08E] hover:bg-[#34B07F] disabled:bg-[#E5E8EB] disabled:text-[#B0B8C1] text-white font-bold text-sm shadow-md transition"
              >
                {isSubmittingOrder ? "예약 접수 중..." : "픽업 예약하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. 모달 C: 제품 상세 및 사진 슬라이더 모달 (#promoModal)
         ------------------------------------------------------------- */}
      {promoProduct && (
        <div
          role="dialog"
          aria-label={
            orderSuccessReceipt
              ? "예약 접수 완료"
              : promoProduct
                ? "상품 상세"
                : isCartModalOpen
                  ? "장바구니 예약"
                  : "단품 예약"
          }
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#191F28]/45 flex items-center justify-center p-4"
          onClick={() => setPromoProduct(null)}
        >
          <div
            className="bg-white w-full max-w-[500px] rounded-2xl border border-[#E5E8EB] shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E8EB] shrink-0">
              <h2 className="text-base font-bold text-[#191F28] m-0 truncate pr-4">
                {promoProduct.name}
              </h2>
              <button
                type="button"
                onClick={() => setPromoProduct(null)}
                className="w-8 h-8 rounded-full bg-[#F2F4F6] text-[#8B95A1] text-lg font-bold flex items-center justify-center shrink-0"
              >
                &times;
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              {promoProduct.images.length > 0 && (
                <div className="relative rounded-xl overflow-hidden bg-black h-64 flex items-center justify-center">
                  <SafeImage
                    src={
                      promoProduct.images[activeImageIndex] ||
                      promoProduct.images[0]
                    }
                    alt={promoProduct.name}
                    className="max-h-full max-w-full object-contain"
                  />
                  {promoProduct.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveImageIndex((prev) =>
                            prev > 0
                              ? prev - 1
                              : promoProduct.images.length - 1,
                          )
                        }
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold"
                      >
                        &lt;
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveImageIndex((prev) =>
                            prev < promoProduct.images.length - 1
                              ? prev + 1
                              : 0,
                          )
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold"
                      >
                        &gt;
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#F2F4F6] text-sm text-[#191F28] leading-relaxed whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[#E8F3FF] text-[#1B64DA]">
                    🏬 매장 픽업 상품
                  </span>
                </div>
                <div className="font-bold text-base mb-1">
                  {formatKRW(promoProduct.price)} ({promoProduct.unit_label})
                </div>
                {promoProduct.brix && <div>🍯 당도: {promoProduct.brix}</div>}
                <div>📍 산지: {promoProduct.origin || "국산"}</div>
                {promoProduct.description && (
                  <div className="mt-2 pt-2 border-t border-[#E5E8EB]">
                    {promoProduct.description}
                  </div>
                )}
              </div>
            </div>

            <div className="flex border-t border-[#E5E8EB] shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = promoProduct;
                  setPromoProduct(null);
                  openOrderModal(target);
                }}
                className="flex-1 py-3.5 bg-[#E8F3FF] text-[#1B64DA] font-bold text-sm border-r border-[#E5E8EB] hover:bg-[#d6e9ff]"
              >
                주문하기
              </button>
              <button
                type="button"
                onClick={() => {
                  addToCart(promoProduct);
                  setPromoProduct(null);
                }}
                className="flex-1 py-3.5 bg-[#E8F8F0] text-[#03B26C] font-bold text-sm hover:bg-[#d4f3e4]"
              >
                장바구니
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6-2. 모달 D: 픽업 예약 완료 & 공구방 안내 모달
         ------------------------------------------------------------- */}
      {orderSuccessReceipt && (
        <div
          role="dialog"
          aria-label={
            orderSuccessReceipt
              ? "예약 접수 완료"
              : promoProduct
                ? "상품 상세"
                : isCartModalOpen
                  ? "장바구니 예약"
                  : "단품 예약"
          }
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#191F28]/45 flex items-center justify-center p-4"
          onClick={() => setOrderSuccessReceipt(null)}
        >
          <div
            className="bg-white w-full max-w-[390px] rounded-2xl border border-[#E5E8EB] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E5E8EB] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#191F28] m-0">
                ✅ 픽업 예약이 접수되었습니다
              </h2>
              <button
                type="button"
                onClick={() => setOrderSuccessReceipt(null)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-[#F2F4F6] text-[#8B95A1] text-lg font-bold flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div className="text-xs break-all">
                주문번호: <strong>{orderSuccessReceipt.order.id}</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E8EB] text-xs space-y-1">
                <div>
                  결제 방식:{" "}
                  <strong>
                    {formatPaymentMethodLabel(
                      orderSuccessReceipt.order.payment_method,
                    )}
                  </strong>
                  {orderSuccessReceipt.order.payment_method === "ONSITE"
                    ? " (매장 방문 시 카드·현금 결제)"
                    : settings?.bank_account
                      ? ` (${settings.bank_account})`
                      : ""}
                </div>
                <div>
                  픽업 예정:{" "}
                  <strong>{orderSuccessReceipt.order.pickup_time}</strong>
                </div>
              </div>
              <p className="text-sm">
                픽업 안내: {settings?.pickup_guide}
                <br />
                {orderSuccessReceipt.order.payment_method === "ONSITE"
                  ? "매장 방문 시 현장 결제 후 수령하시면 됩니다."
                  : "예약 접수와 입금 확인은 별도입니다. 준비 상태는 예약 내역에서 확인해 주세요."}
              </p>
              <div className="p-3.5 rounded-xl bg-[#E8F8F0] border border-[#b8ebd4] text-xs text-[#027A48] font-semibold leading-relaxed">
                {orderSuccessReceipt.copied
                  ? "주문서가 클립보드에 복사되었습니다. 아래 [공구방으로 이동] 버튼을 눌러 채팅방에 붙여넣기해 주세요!"
                  : "예약 접수가 완료되었습니다. 아래 [주문서 복사] 후 공구방에 붙여넣기해 주세요!"}
              </div>

              <pre className="p-3.5 rounded-xl bg-[#F2F4F6] text-xs text-[#191F28] whitespace-pre-wrap font-sans leading-relaxed">
                {orderSuccessReceipt.clipboardText}
              </pre>

              <div className="text-right text-sm font-bold text-[#0064FF]">
                결제 예정 금액:{" "}
                {formatKRW(orderSuccessReceipt.order.total_amount)}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyTextSafe(
                      orderSuccessReceipt.clipboardText,
                    );
                    if (ok) {
                      setOrderSuccessReceipt((prev) =>
                        prev ? { ...prev, copied: true } : null,
                      );
                      showToast("주문서가 다시 복사되었습니다!");
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#F2F4F6] text-[#191F28] font-bold text-sm hover:bg-[#E5E8EB] transition"
                >
                  주문서 복사
                </button>
                {settings?.kakao_openchat_url ? (
                  <a
                    href={settings.kakao_openchat_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOrderSuccessReceipt(null)}
                    className="flex-1 py-3 rounded-xl bg-[#FEE500] text-[#191919] font-extrabold text-sm text-center hover:brightness-95 transition"
                  >
                    공구방으로 이동
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOrderSuccessReceipt(null)}
                    className="flex-1 py-3 rounded-xl bg-[#4F92F8] text-white font-bold text-sm"
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          7. 토스트 안내 메시지 (.cart-toast)
         ------------------------------------------------------------- */}
      {toastText && (
        <div className="fixed left-1/2 bottom-28 -translate-x-1/2 z-50 bg-[#191F28]/90 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg text-center whitespace-pre-line pointer-events-none transition">
          {toastText}
        </div>
      )}
    </div>
  );
}
