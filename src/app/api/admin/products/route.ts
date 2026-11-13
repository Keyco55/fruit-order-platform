import { NextRequest, NextResponse } from "next/server";
import {
  createProductAdmin,
  deleteProductAdmin,
  getProductAggregations,
  getProducts,
  updateProductAdmin,
} from "@/lib/store";
import type { CreateProductInput, Product } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProductInput;
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "과일 상품명을 입력해 주세요." },
        { status: 400 }
      );
    }

    const product = createProductAdmin(body);
    return NextResponse.json(
      {
        product,
        products: getProducts({ includeHidden: true }),
        aggregations: getProductAggregations(),
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "상품 등록에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id: string;
      patch: Partial<Omit<Product, "id" | "created_at">>;
    };

    if (!body.id) {
      return NextResponse.json(
        { error: "상품 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const updated = updateProductAdmin(body.id, body.patch);
    return NextResponse.json({
      product: updated,
      products: getProducts({ includeHidden: true }),
      aggregations: getProductAggregations(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "상품 수정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "삭제할 상품 ID가 필요합니다." },
      { status: 400 }
    );
  }

  deleteProductAdmin(id);
  return NextResponse.json({
    products: getProducts({ includeHidden: true }),
    aggregations: getProductAggregations(),
  });
}
