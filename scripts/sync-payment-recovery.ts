
import 'dotenv/config';
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";
import { PortOneV2Client } from "../server/portone-v2-client";

async function syncPayment() {
    const paymentKey = 'pay_UYm5bGn0lrtJmUFKY2KqYa';
    console.log(`Syncing payment: ${paymentKey}`);

    // 1. Initialize Client
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

        console.log("✅ Fetched Payment Data:", JSON.stringify(paymentData, null, 2));

        const status = paymentData.status;
        const orderId = paymentData.order_id || paymentData.orderId || paymentKey;
        const paymentId = paymentData.id || paymentData.paymentId; // Get canonical ID from PortOne

        // Amount
        let amount = "0";
        if (paymentData.amount) {
            if (typeof paymentData.amount === 'object') {
                amount = (paymentData.amount.total || paymentData.amount.paid || "0").toString();
            } else {
                amount = paymentData.amount.toString();
            }
        }

        const method = paymentData.method?.type || paymentData.method || 'CARD';
        const requestedAt = paymentData.requestedAt || paymentData.requested_at;
        const approvedAt = paymentData.paidAt || paymentData.approved_at || paymentData.approvedAt;
        const customer = paymentData.customer;

        console.log(`Processing Order ID: ${orderId}`);

        // 3. Find Order in DB
        const orderResults = await db.select().from(orders).where(eq(orders.orderId, orderId));
        const order = orderResults[0];

        // 4. Update or Insert Payment
        // First, check if a payment with this ORDER ID exists (to fix the garbage record)
        const existingByOrder = await db.select().from(payments).where(eq(payments.orderId, orderId));
        const targetPayment = existingByOrder[0];

        if (targetPayment) {
            console.log(`⚠️ Payment record found (ID: ${targetPayment.id}, Key: ${targetPayment.paymentKey}). Updating...`);

            await db.update(payments).set({
                status: status === 'PAID' ? 'COMPLETED' : status,
                amount: amount,
                userId: order?.userId || targetPayment.userId,
                paymentKey: paymentId || paymentKey, // Update to canonical key if different
                method: JSON.stringify(method),
                customerName: customer?.name || null,
                customerEmail: customer?.email || null,
                customerMobilePhone: customer?.phoneNumber || null,
                approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
                updatedAt: new Date()
            }).where(eq(payments.id, targetPayment.id));
            console.log("✅ Payment updated.");
        } else {
            console.log("Creating new payment record...");
            await db.insert(payments).values({
                userId: order?.userId || 1, // Fallback
                bidId: null,
                orderId: orderId,
                orderName: `상품 주문: ${orderId}`,
                amount: amount,
                status: status === 'PAID' ? 'COMPLETED' : status,
                paymentKey: paymentId || paymentKey,
                merchantId: paymentData.merchantId || "MOI3204387",
                method: JSON.stringify(method),
                customerName: customer?.name || null,
                customerEmail: customer?.email || null,
                customerMobilePhone: customer?.phoneNumber || null,
                requestedAt: requestedAt ? new Date(requestedAt) : new Date(),
                approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log("✅ Payment inserted.");
        }

    } catch (error) {
        console.error("Error syncing payment:", error);
    }
    process.exit(0);
}

syncPayment();
