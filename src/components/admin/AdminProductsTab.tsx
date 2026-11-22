"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronsUp,
  Eye,
  EyeOff,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatKRW, matchesKoreanSearch } from "@/lib/formatters";
import { compressImageToWebpDataUrl } from "@/lib/image-compressor";
import type { CreateProductInput, Product } from "@/types/domain";

const QUICK_FRUIT_PRESETS = [
  {
    name: "설향 딸기 (특품)",
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
    name: "고당도 샤인머스켓",
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
    description:
      "향긋하고 부드러운 과육에 꿀당도를 자랑하는 백도 복숭아입니다.",
    image:
      "https://images.unsplash.com/photo-1629828874514-c1e5103f2150?auto=format&fit=crop&w=900&q=80",
  },
];

interface AdminProductsTabProps {
  products: Product[];
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
  onRefresh: () => void;
  onCreateProduct: (input: CreateProductInput) => Promise<boolean>;
  onPatchProduct: (
    productId: string,
    patch: Partial<Product>,
    successMsg: string,
    expectedVersion?: number,
  ) => Promise<boolean>;
  onReorderProducts: (orderedIds: string[]) => Promise<void>;
  onAdjustStock: (productId: string, delta: number) => Promise<void>;
  onDeleteProduct: (productId: string, name: string) => Promise<void>;
  showToast: (msg: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function AdminProductsTab({
  products,
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
  onCreateProduct,
  onPatchProduct,
  onReorderProducts,
  onAdjustStock,
  onDeleteProduct,
  showToast,
  onDirtyChange,
}: AdminProductsTabProps) {
  const [subView, setSubView] = useState<"LIST" | "CREATE">("LIST");
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState<
    "ALL" | "SOLDOUT" | "HIDDEN"
  >("ALL");
  const [isCreating, setIsCreating] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  // 빠른 수정 상태
  const [newProductDirty, setNewProductDirty] = useState(false);
  const editBaseline = useRef<Product | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const savingEditRef = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    unit_label: string;
    origin: string;
    price: string;
    remain_stock: string;
    total_stock: string;
    is_limited: boolean;
  }>({
    name: "",
    unit_label: "",
    origin: "국산",
    price: "",
    remain_stock: "0",
    total_stock: "0",
    is_limited: true,
  });

  // 새 과일 30초 등록 폼 상태
  const [prodName, setProdName] = useState("");
  const [prodUnit, setProdUnit] = useState("500g 1팩");
  const [prodPrice, setProdPrice] = useState("12900");
  const [prodOriginalPrice, setProdOriginalPrice] = useState("");
  const [prodOrigin, setProdOrigin] = useState("국산");
  const [prodBrix, setProdBrix] = useState("");
  const [prodBadge, setProdBadge] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImage, setProdImage] = useState(
    "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=900&q=80",
  );
  const [prodIsLimited, setProdIsLimited] = useState(true);
  const [prodStock, setProdStock] = useState("30");
  const [prodIsReceived, setProdIsReceived] = useState(true);
  const [isCompressingImg, setIsCompressingImg] = useState(false);

  const resetCreateForm = () => {
    setProdName("");
    setProdUnit("500g 1팩");
    setProdPrice("12900");
    setProdOriginalPrice("");
    setProdOrigin("국산");
    setProdBrix("");
    setProdBadge("");
    setProdDesc("");
    setProdIsLimited(true);
    setProdStock("30");
    setProdIsReceived(true);
    setNewProductDirty(false);
  };

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );

  const productPositionMap = useMemo(
    () => new Map(sortedProducts.map((p, idx) => [p.id, idx + 1])),
    [sortedProducts],
  );

  const filteredProducts = useMemo(() => {
    return sortedProducts.filter((p) => {
      if (productFilter === "SOLDOUT" && !(p.is_limited && p.remain_stock <= 0))
        return false;
      if (productFilter === "HIDDEN" && p.is_visible) return false;
      if (productSearch.trim() && !matchesKoreanSearch(p.name, productSearch)) {
        return false;
      }
      return true;
    });
  }, [sortedProducts, productFilter, productSearch]);

  const handleMoveProduct = async (
    productId: string,
    direction: "TOP" | "UP" | "DOWN",
  ) => {
    if (busyProductId) return;
    const fullIds = sortedProducts.map((p) => p.id);
    const fullIndex = fullIds.indexOf(productId);
    if (fullIndex === -1) return;

    let nextIds: string[];
    if (direction === "TOP") {
      if (fullIndex === 0) return;
      nextIds = [
        productId,
        ...fullIds.filter((existingId) => existingId !== productId),
      ];
    } else {
      const visibleIds = filteredProducts.map((p) => p.id);
      const visibleIndex = visibleIds.indexOf(productId);
      const targetVisibleIndex =
        direction === "UP" ? visibleIndex - 1 : visibleIndex + 1;
      if (
        visibleIndex === -1 ||
        targetVisibleIndex < 0 ||
        targetVisibleIndex >= visibleIds.length
      ) {
        return;
      }
      const neighborId = visibleIds[targetVisibleIndex];
      const neighborFullIndex = fullIds.indexOf(neighborId);
      if (neighborFullIndex === -1) return;
      nextIds = [...fullIds];
      nextIds[fullIndex] = neighborId;
      nextIds[neighborFullIndex] = productId;
    }

    setBusyProductId(productId);
    try {
      await onReorderProducts(nextIds);
    } finally {
      setBusyProductId(null);
    }
  };

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
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

  const handleAdjustStock = async (product: Product, delta: number) => {
    if (busyProductId === product.id) return;
    setBusyProductId(product.id);
    try {
      await onAdjustStock(product.id, delta);
    } finally {
      setBusyProductId(null);
    }
  };

  const startInlineEdit = (product: Product) => {
    if (
      editingId &&
      !confirm("현재 수정 내용을 버리고 다른 상품을 편집할까요?")
    )
      return;
    editBaseline.current = { ...product };
    setEditingId(product.id);
    setEditDraft({
      name: product.name,
      unit_label: product.unit_label,
      origin: product.origin || "국산",
      price: String(product.price),
      remain_stock: String(product.remain_stock),
      total_stock: String(product.total_stock),
      is_limited: product.is_limited,
    });
  };

  useEffect(() => {
    onDirtyChange(!!editingId || newProductDirty);
  }, [editingId, newProductDirty, onDirtyChange]);
  const saveInlineEdit = async (product: Product) => {
    if (savingEditRef.current) return;
    const original = editBaseline.current;
    if (!original) return;
    const patch: Partial<Product> = {};
    const next: Partial<Product> = {
      name: editDraft.name.trim(),
      unit_label: editDraft.unit_label.trim(),
      origin: editDraft.origin.trim() || "국산",
      price: Number(editDraft.price),
      is_limited: editDraft.is_limited,
      remain_stock: Number(editDraft.remain_stock),
      total_stock: Number(editDraft.total_stock),
    };
    if (
      !next.name ||
      !next.unit_label ||
      ![next.price, next.remain_stock, next.total_stock].every(
        (v) => Number.isInteger(v) && v! >= 0,
      ) ||
      next.remain_stock! > next.total_stock!
    ) {
      showToast("상품명·단위와 0 이상의 정수 가격·재고를 확인해 주세요.");
      return;
    }
    for (const key of Object.keys(next) as Array<keyof Product>) {
      if (next[key] !== original[key])
        Object.assign(patch, { [key]: next[key] });
    }
    if (!Object.keys(patch).length) {
      setEditingId(null);
      return;
    }
    savingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      const ok = await onPatchProduct(
        product.id,
        patch,
        "상품 정보를 수정했습니다.",
        original.stock_version ?? 0,
      );
      if (ok) setEditingId(null);
    } catch {
      showToast("저장하지 못했습니다. 편집값은 보존됩니다.");
    } finally {
      savingEditRef.current = false;
      setIsSavingEdit(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    if (!prodName.trim()) {
      showToast("과일명을 입력해 주세요.");
      return;
    }

    const parsedStock =
      prodStock.trim() === "" ? 0 : Math.max(0, Math.floor(Number(prodStock)));
    if (!Number.isFinite(parsedStock)) {
      showToast("재고 수량을 숫자로 정확히 입력해 주세요.");
      return;
    }

    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setIsCreating(true);
    try {
      const ok = await onCreateProduct({
        category: "PICKUP",
        name: prodName.trim(),
        unit_label: prodUnit.trim() || "1팩",
        price: Math.max(0, Math.floor(Number(prodPrice) || 0)),
        original_price: prodOriginalPrice
          ? Math.max(0, Math.floor(Number(prodOriginalPrice)))
          : undefined,
        origin: prodOrigin.trim() || "국산",
        brix: prodBrix.trim() || undefined,
        badge_text: prodBadge.trim() || undefined,
        description:
          prodDesc.trim() ||
          "오늘 새벽 가락시장에서 직접 선별한 고당도 신선 과일입니다.",
        images: [prodImage],
        is_limited: prodIsLimited,
        total_stock: parsedStock,
        remain_stock: parsedStock,
        is_received: prodIsReceived,
        is_visible: true,
        idempotency_key: requestId,
      });

      if (ok) {
        resetCreateForm();
        setSubView("LIST");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 & 상품·재고 전용 새로고침 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            📦 상품 · 재고 관리 ({products.length}종)
          </h2>
          <p className="text-xs text-slate-500">
            재고 수량을 바로 증감하거나 새 과일을 30초 만에 등록하세요.
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
            <span>{isRefreshing ? "새로고침 중..." : "재고 새로고침"}</span>
          </button>
        </div>
      </div>

      {/* 서브뷰 전환: 재고 목록 vs 새 과일 등록 */}
      <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-2xs">
        <button
          type="button"
          onClick={() => setSubView("LIST")}
          className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
            subView === "LIST"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📦 재고 · 상품 목록 ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setSubView("CREATE")}
          className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
            subView === "CREATE"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          ➕ 새 과일 30초 등록
        </button>
      </div>

      {subView === "LIST" ? (
        <div className="space-y-3">
          {/* 검색 & 필터 */}
          <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <label
                htmlFor="admin-AdminProductsTab-input-1"
                className="sr-only"
              >
                상품명 또는 초성 검색 (예: ㄸㄱ, 샤인)
              </label>
              <input
                id="admin-AdminProductsTab-input-1"
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="상품명 또는 초성 검색 (예: ㄸㄱ, 샤인)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "ALL", label: "전체" },
                { id: "SOLDOUT", label: "품절만" },
                { id: "HIDDEN", label: "숨김만" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setProductFilter(tab.id as "ALL" | "SOLDOUT" | "HIDDEN")
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    productFilter === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* 상품 재고 관리 카드 */}
          <section className="space-y-2.5">
            {filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
                조건에 맞는 상품이 없습니다.
              </div>
            ) : (
              filteredProducts.map((p, visibleIndex) => {
                const isSoldOut = p.is_limited && p.remain_stock <= 0;
                const stockPct =
                  p.is_limited && p.total_stock > 0
                    ? Math.min(
                        100,
                        Math.round((p.remain_stock / p.total_stock) * 100),
                      )
                    : 100;
                const isEditing = editingId === p.id;
                const displayPosition =
                  productPositionMap.get(p.id) ?? visibleIndex + 1;
                const isFirstVisible = visibleIndex === 0;
                const isLastVisible =
                  visibleIndex === filteredProducts.length - 1;
                const isFirstOverall = displayPosition === 1;

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-3xl border space-y-3 transition ${
                      !p.is_visible
                        ? "bg-slate-50 border-slate-200 opacity-70"
                        : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="손님 화면 노출 순서"
                            >
                              노출 {displayPosition}번
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-blue-50 text-blue-700">
                              픽업
                            </span>
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
                            {p.unit_label} · {p.origin || "국산"} ·{" "}
                            <strong className="text-slate-900">
                              {formatKRW(p.price)}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5 mr-0.5">
                          <button
                            type="button"
                            disabled={isFirstOverall || busyProductId !== null}
                            onClick={() => void handleMoveProduct(p.id, "TOP")}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-emerald-700 disabled:opacity-35"
                            title="맨 위(1번)로 올리기"
                            aria-label={`${p.name} 맨 위로 올리기`}
                          >
                            <ChevronsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isFirstVisible || busyProductId !== null}
                            onClick={() => void handleMoveProduct(p.id, "UP")}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35"
                            title="순서 한 칸 위로"
                            aria-label={`${p.name} 순서 위로`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLastVisible || busyProductId !== null}
                            onClick={() =>
                              void handleMoveProduct(p.id, "DOWN")
                            }
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35"
                            title="순서 한 칸 아래로"
                            aria-label={`${p.name} 순서 아래로`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingId(null) : startInlineEdit(p)
                          }
                          className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                          title="상품명·산지·가격·재고 직접 수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onPatchProduct(
                              p.id,
                              { is_visible: !p.is_visible },
                              p.is_visible
                                ? "손님 화면에서 숨김 처리되었습니다."
                                : "손님 화면에 다시 노출됩니다.",
                            )
                          }
                          className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                          title="노출/숨김 토글"
                        >
                          {p.is_visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteProduct(p.id, p.name)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 인라인 빠른 수정 폼 */}
                    {isEditing && (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <label
                            htmlFor="admin-AdminProductsTab-input-2"
                            className="sr-only"
                          >
                            상품명
                          </label>
                          <input
                            id="admin-AdminProductsTab-input-2"
                            type="text"
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                name: e.target.value,
                              })
                            }
                            placeholder="상품명"
                            className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold"
                          />
                          <label
                            htmlFor="admin-AdminProductsTab-input-3"
                            className="sr-only"
                          >
                            단위 (예: 1팩)
                          </label>
                          <input
                            id="admin-AdminProductsTab-input-3"
                            type="text"
                            value={editDraft.unit_label}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                unit_label: e.target.value,
                              })
                            }
                            placeholder="단위 (예: 1팩)"
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold"
                          />
                          <label
                            htmlFor="admin-AdminProductsTab-input-origin"
                            className="sr-only"
                          >
                            산지 (원산지)
                          </label>
                          <input
                            id="admin-AdminProductsTab-input-origin"
                            type="text"
                            value={editDraft.origin}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                origin: e.target.value,
                              })
                            }
                            placeholder="산지 (예: 국산)"
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold"
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                          <div>
                            <label
                              htmlFor="product-field-1"
                              className="block text-[11px] font-bold text-slate-500 mb-0.5"
                            >
                              판매가격(원)
                            </label>
                            <input
                              id="product-field-1"
                              type="number"
                              value={editDraft.price}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  price: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-extrabold"
                            />
                          </div>
                          <label className="flex items-center gap-1.5 font-bold text-slate-700 pt-4">
                            <input
                              type="checkbox"
                              checked={editDraft.is_limited}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  is_limited: e.target.checked,
                                })
                              }
                            />
                            <span>한정수량</span>
                          </label>
                          {editDraft.is_limited && (
                            <>
                              <div>
                                <label
                                  htmlFor="edit-remain-stock"
                                  className="block text-[11px] font-bold text-slate-500 mb-0.5"
                                >
                                  남은 재고
                                </label>
                                <input
                                  id="edit-remain-stock"
                                  type="number"
                                  value={editDraft.remain_stock}
                                  onChange={(e) =>
                                    setEditDraft({
                                      ...editDraft,
                                      remain_stock: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-extrabold"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="product-field-2"
                                  className="block text-[11px] font-bold text-slate-500 mb-0.5"
                                >
                                  총 수량
                                </label>
                                <input
                                  id="product-field-2"
                                  type="number"
                                  value={editDraft.total_stock}
                                  onChange={(e) =>
                                    setEditDraft({
                                      ...editDraft,
                                      total_stock: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold"
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-600"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={() => void saveInlineEdit(p)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold"
                          >
                            수정 저장
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 재고 게이지 + 원터치 +/- 컨트롤 */}
                    <div className="bg-slate-50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex-1 min-w-[160px] space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            {p.is_limited
                              ? isSoldOut
                                ? "품절 (남은 수량 0개)"
                                : `잔여 ${p.remain_stock} / ${p.total_stock}개`
                              : "무제한 판매 (∞)"}
                          </span>
                          {p.is_limited && (
                            <span
                              className={`font-extrabold text-[11px] ${
                                isSoldOut ? "text-rose-600" : "text-emerald-700"
                              }`}
                            >
                              {stockPct}%
                            </span>
                          )}
                        </div>
                        {p.is_limited && (
                          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isSoldOut
                                  ? "bg-rose-500"
                                  : stockPct <= 25
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${stockPct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {p.is_limited && (
                          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-extrabold">
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(p, -5)}
                              disabled={
                                p.remain_stock <= 0 || busyProductId === p.id
                              }
                              className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(p, -1)}
                              disabled={
                                p.remain_stock <= 0 || busyProductId === p.id
                              }
                              aria-label="재고 1 감소"
                              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(p, 1)}
                              disabled={busyProductId === p.id}
                              aria-label="재고 1 증가"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 disabled:opacity-30 text-emerald-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAdjustStock(p, 5)}
                              disabled={busyProductId === p.id}
                              className="px-2 py-1 rounded-lg hover:bg-emerald-50 disabled:opacity-30 text-emerald-700"
                            >
                              +5
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void onPatchProduct(
                              p.id,
                              { is_received: !p.is_received },
                              "입고 상태가 변경되었습니다.",
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
                            onClick={() => {
                              const refillQty =
                                p.total_stock > 0 ? p.total_stock : 10;
                              void onPatchProduct(
                                p.id,
                                {
                                  remain_stock: isSoldOut ? refillQty : 0,
                                },
                                isSoldOut
                                  ? `재고(${refillQty}개)가 복구되었습니다.`
                                  : "품절 처리되었습니다.",
                              );
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                              isSoldOut
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {isSoldOut ? "전체리필" : "품절"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      ) : (
        /* 새 과일 30초 등록 폼 */
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              🍓 오늘의 과일 30초 간편 등록
            </h3>
            <p className="text-xs text-slate-500">
              자주 파는 과일 버튼을 누르면 정보가 자동 입력되어 가격과 수량만
              바꾸면 끝납니다.
            </p>
          </div>

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
                      `✨ '${preset.name}' 정보를 불러왔습니다. 수량/가격만 확인 후 등록하세요!`,
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition"
                >
                  + {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={resetCreateForm}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
              >
                입력 초기화
              </button>
            </div>
          </div>

          <form
            onChangeCapture={() => setNewProductDirty(true)}
            onSubmit={handleCreateSubmit}
            className="space-y-3 pt-2"
          >
            <div>
              <label
                htmlFor="product-field-3"
                className="block text-xs font-bold text-slate-600 mb-1"
              >
                과일 상품명 * (매장 픽업 전용)
              </label>
              <input
                id="product-field-3"
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="예: 설향 딸기 3x5"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                입력하신 상품명 그대로 손님 주문 화면에 표시됩니다. (산지는 아래
                산지 칸에 별도 입력)
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label
                  htmlFor="product-field-4"
                  className="block text-xs font-bold text-slate-600 mb-1"
                >
                  판매 단위
                </label>
                <input
                  id="product-field-4"
                  type="text"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  placeholder="예: 500g 1팩"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold"
                />
              </div>
              <div>
                <label
                  htmlFor="product-field-5"
                  className="block text-xs font-bold text-slate-600 mb-1"
                >
                  판매 가격(원) *
                </label>
                <input
                  id="product-field-5"
                  type="number"
                  required
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-extrabold text-emerald-700"
                />
              </div>
              <div>
                <label
                  htmlFor="product-field-6"
                  className="block text-xs font-bold text-slate-600 mb-1"
                >
                  할인전 원가(선택)
                </label>
                <input
                  id="product-field-6"
                  type="number"
                  value={prodOriginalPrice}
                  onChange={(e) => setProdOriginalPrice(e.target.value)}
                  placeholder="선택 입력"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="product-field-origin"
                  className="block text-xs font-bold text-slate-600 mb-1"
                >
                  산지(원산지)
                </label>
                <input
                  id="product-field-origin"
                  type="text"
                  value={prodOrigin}
                  onChange={(e) => setProdOrigin(e.target.value)}
                  placeholder="예: 충남 논산"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold"
                />
              </div>
              <div>
                <label
                  htmlFor="product-field-7"
                  className="block text-xs font-bold text-slate-600 mb-1"
                >
                  당도(선택)
                </label>
                <input
                  id="product-field-7"
                  type="text"
                  value={prodBrix}
                  onChange={(e) => setProdBrix(e.target.value)}
                  placeholder="예: 15 Brix"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-xs"
                />
              </div>
            </div>

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
              <label
                htmlFor="admin-AdminProductsTab-input-4"
                className="sr-only"
              >
                사장님 한줄 설명 (예: 오늘 경매 1등품! 과즙이 끝내줍니다)
              </label>
              <input
                id="admin-AdminProductsTab-input-4"
                type="text"
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="사장님 한줄 설명 (예: 오늘 경매 1등품! 과즙이 끝내줍니다)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-sm transition"
            >
              {isCreating
                ? "상품 등록 중..."
                : "+ 오늘의 판매 과일로 즉시 등록하기"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
