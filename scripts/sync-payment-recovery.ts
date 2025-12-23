
import 'dotenv/config';
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";
import { PortOneV2Client } from "../server/portone-v2-client";

async function syncPayment() {
    const paymentKey = 'pay_G2sIZMK0LUB8x1zbU8xDkH';
    console.log(`Syncing payment: ${paymentKey}`);

    // 1. Initialize PortOne Client
    const secret = process.env.PORTONE_API_SECRET || process.env.PORTONE_V2_API_SECRET;
    if (!secret) {
        console.error("❌ PORTONE_API_SECRET is missing!");
        process.exit(1);
    }
    const client = new PortOneV2Client(secret);

    try {
        // 2. Fetch from PortOne
        let paymentData;
        try {
            paymentData = await client.getPayment(paymentKey);
        } catch (e) {
            console.error("❌ Failed to fetch payment from PortOne:", e.message);
            process.exit(1);
        }

        if (!paymentData) {
            console.error("❌ Payment data is null");
            process.exit(1);
        }

        console.log("✅ Fetched Payment Data.");

        const status = paymentData.status;
        // Fallback: If order_id is missing from PortOne response, use paymentKey 
        // (since we verified order #229 has orderId == paymentKey)
        const orderId = paymentData.order_id || paymentData.orderId || paymentKey;

        const amount = (paymentData.amount?.total || paymentData.amount || 0).toString();
        const method = paymentData.method?.type || paymentData.method || 'CARD';
        // JSON response had method: { type: 'PaymentMethodCard', ... } but schema expects string? 
        // Client code usually handles this. Let's start with simple string "CARD" or extract type.

        const requestedAt = paymentData.requestedAt || paymentData.requested_at;
        const approvedAt = paymentData.paidAt || paymentData.approved_at || paymentData.approvedAt;
        const merchantId = paymentData.merchantId || "MOI3204387";

        console.log(`Processing Order ID: ${orderId}`);

        // 3. Check Order
        const orderResults = await db.select().from(orders).where(eq(orders.orderId, orderId));
        const order = orderResults[0];

        if (!order) {
            console.error(`❌ Order ${orderId} not found in DB! Cannot create payment.`);
            // Try searching by payment info? No, let's stop.
            process.exit(1);
        }
        console.log("✅ Found Local Order:", order.id);

        // 4. Check if Payment already exists
        const existingPaymentResults = await db.select().from(payments).where(eq(payments.paymentKey, paymentKey));
        if (existingPaymentResults.length > 0) {
            console.log("⚠️ Payment already exists in DB. updating...");
            await db.update(payments).set({
                status: status,
                approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
                updatedAt: new Date()
            }).where(eq(payments.paymentKey, paymentKey));
            console.log("✅ Payment updated.");
        } else {
            console.log("Creating new payment record...");

            await db.insert(payments).values({
                userId: order.userId,
                bidId: null,
                orderId: orderId,
                orderName: `상품 주문: ${orderId}`, // Matches webhook format
                amount: amount,
                status: status === 'PAID' ? 'COMPLETED' : status, // Map status
                paymentKey: paymentKey,
                merchantId: merchantId,
                method: JSON.stringify(method), // Store as string
                requestedAt: requestedAt ? new Date(requestedAt) : new Date(),
                approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log("✅ Payment inserted successfully.");

            // Update Order status
            if (status === 'PAID') {
                await db.update(orders).set({
                    status: 'paid',
                    updatedAt: new Date()
                }).where(eq(orders.id, order.id));
                console.log("✅ Order status updated to 'paid'.");
            }
        }

    } catch (error) {
        console.error("Error syncing payment:", error);
    }
    process.exit(0);
}

syncPayment();
