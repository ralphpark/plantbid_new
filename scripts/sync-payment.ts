import "dotenv/config";
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";

async function syncPayment() {
  const orderId = "pay_1765996007318ju8czgfff";

  console.log("=== 결제 정보 수동 동기화 ===");

  // 1. 주문 정보 확인
  const order = await db.query.orders.findFirst({
    where: eq(orders.order_id, orderId)
  });

  if (order === null || order === undefined) {
    console.log("주문을 찾을 수 없습니다");
    return;
  }

  console.log("주문 ID:", order.id);
  console.log("현재 상태:", order.status);

  // 2. 결제 정보가 이미 있는지 확인
  const existingPayment = await db.query.payments.findFirst({
    where: eq(payments.order_id, orderId)
  });

  if (existingPayment) {
    console.log("결제 정보가 이미 존재합니다:", existingPayment.id);
    return;
  }

  // 3. 결제 정보 생성
  const newPayment = await db.insert(payments).values({
    user_id: order.user_id,
    bid_id: order.vendor_id || 1,
    order_id: orderId,
    order_name: "해마리아 외 0건",
    amount: order.price.toString(),
    method: "CARD",
    status: "COMPLETED",
    payment_key: orderId,
    customer_name: "ralphpark01",
    approved_at: new Date("2025-12-17T18:28:11.511Z"),
    created_at: new Date()
  }).returning();

  console.log("결제 정보 생성 완료:", newPayment[0]?.id);

  // 4. 주문 상태 업데이트
  await db.update(orders)
    .set({
      status: "paid",
      updated_at: new Date()
    })
    .where(eq(orders.id, order.id));

  console.log("주문 상태 업데이트 완료: paid");

  console.log("\n=== 동기화 완료 ===");
}

syncPayment().then(() => process.exit(0)).catch(e => {
  console.error("오류:", e);
  process.exit(1);
});
