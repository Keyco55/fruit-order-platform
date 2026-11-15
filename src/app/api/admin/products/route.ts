import { NextRequest, NextResponse } from "next/server";
import {
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
    const body = (await request.json()) as CreateProductInput;
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "과일 상품명을 입력해 주세요." },
        { status: 400 }
      );
    }

    const product = await createProductAdmin(body);
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

    const updated = await updateProductAdmin(body.id, body.patch);
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "삭제할 상품 ID가 필요합니다." },
        { status: 400 }
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
