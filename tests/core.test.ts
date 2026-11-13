import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  extractChosung,
  formatOrderClipboardText,
  matchesKoreanSearch,
  parseKakaoChatMessage,
} from "../src/lib/formatters";
import {
  createOrder,
  getProductAggregations,
  getProducts,
  resetDemoDatabase,
  updateOrderAdmin,
} from "../src/lib/store";

describe("과일 주문 및 오픈카톡 자동 집계 코어 로직 검증", () => {
  beforeEach(() => {
    resetDemoDatabase();
  });

  it("한글 초성 추출 및 초성 검색이 정상 동작해야 한다", () => {
    assert.equal(extractChosung("과일사랑"), "ㄱㅇㅅㄹ");
    assert.equal(matchesKoreanSearch("논산 설향 딸기", "ㅅㅎㄸㄱ"), true);
    assert.equal(matchesKoreanSearch("과일사랑", "ㄱㅇㅅㄹ"), true);
    assert.equal(matchesKoreanSearch("홍제동맘", "ㅎㅈㄷ"), true);
    assert.equal(matchesKoreanSearch("사과", "ㅂㄴㄴ"), false);
  });

  it("주문 생성 시 한정 수량 재고가 즉시 차감되고 취소 시 복원되어야 한다", () => {
    const beforeProduct = getProducts().find(
      (p) => p.id === "prod-strawberry-1"
    );
    assert.ok(beforeProduct);
    const initialStock = beforeProduct.remain_stock;

    const created = createOrder({
      kakao_nickname: "테스트고객",
      customer_phone_last4: "9999",
      pickup_time: "오늘 19:00",
      memo: "문앞 픽업",
      items: [{ product_id: "prod-strawberry-1", quantity: 3 }],
    });

    assert.equal(created.total_amount, beforeProduct.price * 3);

    const afterProduct = getProducts().find(
      (p) => p.id === "prod-strawberry-1"
    );
    assert.ok(afterProduct);
    assert.equal(afterProduct.remain_stock, initialStock - 3);

    // 주문 취소 시 재고 복원 확인
    updateOrderAdmin(created.id, { status: "CANCELED" });
    const restoredProduct = getProducts().find(
      (p) => p.id === "prod-strawberry-1"
    );
    assert.ok(restoredProduct);
    assert.equal(restoredProduct.remain_stock, initialStock);
  });

  it("잔여 재고를 초과하는 주문은 에러를 반환하고 재고를 차감하지 않아야 한다", () => {
    assert.throws(() => {
      createOrder({
        kakao_nickname: "초과주문고객",
        items: [{ product_id: "prod-strawberry-1", quantity: 999 }],
      });
    }, /남은 수량.*부족합니다/);
  });

  it("오픈카톡 클립보드 복사 텍스트 포맷이 정확히 생성되어야 한다", () => {
    const order = createOrder({
      kakao_nickname: "단골맘",
      customer_phone_last4: "4567",
      pickup_time: "오늘 오후 방문",
      memo: "잘 부탁드려요",
      items: [{ product_id: "prod-strawberry-1", quantity: 2 }],
    });

    const clipboardText = formatOrderClipboardText(order);
    assert.match(clipboardText, /\[주문접수\] 닉네임: 단골맘 \(4567\)/);
    assert.match(clipboardText, /논산 설향 딸기/);
    assert.match(clipboardText, /총 금액: 25,800원/);
  });

  it("오픈카톡 일반 채팅 메시지에서 과일명과 수량을 자동으로 파싱해야 한다", () => {
    const products = getProducts();
    const parsed = parseKakaoChatMessage(
      "설향 딸기 2팩\n샤인머스켓 1박스 예약합니다",
      products
    );

    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], {
      product_id: "prod-strawberry-1",
      quantity: 2,
    });
    assert.deepEqual(parsed[1], {
      product_id: "prod-shine-2",
      quantity: 1,
    });
  });

  it("품목별 총 주문 수량 요약표가 유효 주문만 정확히 합산해야 한다", () => {
    const aggs = getProductAggregations();
    const strawberryAgg = aggs.find(
      (a) => a.product_id === "prod-strawberry-1"
    );
    assert.ok(strawberryAgg);
    // 시드 데이터의 설향 딸기 주문 합계: 과일사랑(2) + 단골손님김씨(1) + 햇살가득(2) = 5개
    assert.equal(strawberryAgg.ordered_quantity, 5);
    assert.equal(strawberryAgg.order_count, 3);
  });
});
