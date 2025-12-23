
import 'dotenv/config';
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";
import { PortOneV2Client } from "../server/portone-v2-client.js";

async function syncPayment() {
    const targetKey = 'pay_TrD1T-DbiSepVr1HygOcOU';
    console.log(`Syncing payment target: ${targetKey}`);

    const secret = process.env.PORTONE_API_SECRET || process.env.PORTONE_V2_API_SECRET;
    if (!secret) {
        console.error("❌ PORTONE_API_SECRET is missing!");
        process.exit(1);
    }
    const client = new PortOneV2Client(secret);

    try {
        // 1. Fetch from PortOne
        let paymentData;
        try {
            console.log("Fetching payment from PortOne...");
            paymentData = await client.getPayment(targetKey);
        } catch (e) {
            console.error("❌ PortOne API Error:", e.message);
        }

        if (paymentData) {
            console.log("✅ PortOne Data Found:", {
                id: paymentData.id,
                status: paymentData.status,
                amount: paymentData.amount
            });
        }

        // 2. Find in DB (Check paymentKey OR orderId)
        // First check paymentKey
        let targetPayment = await db.query.payments.findFirst({
            where: eq(payments.paymentKey, targetKey)
        });

        if (!targetPayment) {
            console.log("⚠️ Not found by paymentKey. Checking by orderId...");
            targetPayment = await db.query.payments.findFirst({
                where: eq(payments.orderId, targetKey)
            });
        }

        if (!targetPayment) {
            console.log("❌ Payment record NOT found in DB.");
            process.exit(0);
        }

        console.log("✅ Found DB Record:", targetPayment);

        // 3. Update DB
        if (paymentData) {
            const status = paymentData.status;
            const amount = typeof paymentData.amount === 'object' ? paymentData.amount.total.toString() : paymentData.amount.toString();
            const customer = paymentData.customer;

            console.log(`Updating DB ID ${targetPayment.id} -> Amount: ${amount}, Status: ${status}`);

            await db.update(payments).set({
                status: status === 'PAID' ? 'COMPLETED' : status,
                amount: amount,
                customerName: customer?.name || null,
                customerEmail: customer?.email || null,
                customerMobilePhone: customer?.phoneNumber || null,
                updatedAt: new Date()
            }).where(eq(payments.id, targetPayment.id));

            console.log("✅ Database updated successfully.");
        }

    } catch (error) {
        console.error("Error syncing payment:", error);
    }
    process.exit(0);
}

syncPayment();
