import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import {
  adjustProductStockAdmin,
  createProductAdmin,
  deleteProductAdmin,
  getProductAggregations,
  getProducts,
  updateProductAdmin,
} from "@/lib/repository";
import type { CreateProductInput, Product } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequestAuthenticated(request))) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }
    const body = (await request.json()) as CreateProductInput;
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "과일 상품명을 입력해 주세요." },
        { status: 400 },
      );
    }

    const totalStock = Number(body.total_stock ?? 0);
    if (!Number.isFinite(totalStock) || totalStock < 0) {
      return NextResponse.json(
        { error: "재고 수량은 0 이상의 정수여야 합니다." },
        { status: 400 },
      );
    }

    const product = await createProductAdmin({
      ...body,
      category: "PICKUP",
      total_stock: Math.floor(totalStock),
      remain_stock:
        body.remain_stock !== undefined
          ? Math.max(0, Math.floor(Number(body.remain_stock)))
          : Math.floor(totalStock),
    });
    const [products, aggregations] = await Promise.all([
      getProducts({ includeHidden: true }),
      getProductAggregations(),
    ]);

    return NextResponse.json(
      {
        product,
        products,
        aggregations,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "상품 등록에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminRequestAuthenticated(request))) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }
    const body = (await request.json()) as {
      id: string;
      stock_delta?: number;
      expected_stock_version?: number;
      patch?: Partial<Omit<Product, "id" | "created_at">>;
    };

    if (!body.id) {
      return NextResponse.json(
        { error: "상품 ID가 필요합니다." },
        { status: 400 },
      );
    }

    let updated: Product;
    if (
      typeof body.stock_delta === "number" &&
      Number.isFinite(body.stock_delta)
    ) {
      updated = await adjustProductStockAdmin(body.id, body.stock_delta);
    } else if (body.patch) {
      const safePatch = { ...body.patch };
      if (safePatch.category !== undefined) {
        safePatch.category = "PICKUP";
      }
      updated = await updateProductAdmin(
        body.id,
        safePatch,
        body.expected_stock_version,
      );
    } else {
      return NextResponse.json(
        { error: "수정할 내용이 필요합니다." },
        { status: 400 },
      );
    }

    const [products, aggregations] = await Promise.all([
      getProducts({ includeHidden: true }),
      getProductAggregations(),
    ]);

    return NextResponse.json({
      product: updated,
      products,
      aggregations,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "상품 수정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminRequestAuthenticated(request))) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "삭제할 상품 ID가 필요합니다." },
        { status: 400 },
      );
    }

    await deleteProductAdmin(id);
    const [products, aggregations] = await Promise.all([
      getProducts({ includeHidden: true }),
      getProductAggregations(),
    ]);

    return NextResponse.json({
      products,
      aggregations,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "상품 삭제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
