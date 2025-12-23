
import 'dotenv/config';
import { db } from "../server/db";
import { payments } from "../shared/schema";
import { eq } from "drizzle-orm";
import { PortOneV2Client } from "../server/portone-v2-client.js";

async function syncPayment() {
    const targetKey = 'pay_TrD1T-DbiSepVr1HygOcOU';
    console.log(`Syncing payment target (fixing mismatch): ${targetKey}`);

    const secret = process.env.PORTONE_API_SECRET || process.env.PORTONE_V2_API_SECRET;
    if (!secret) {
        console.error("❌ PORTONE_API_SECRET is missing!");
        process.exit(1);
    }
    const client = new PortOneV2Client(secret);

    try {
        // 1. Fetch from PortOne to verify the ID is valid
        let paymentData;
        try {
            console.log("Fetching payment from PortOne...");
            paymentData = await client.getPayment(targetKey);
        } catch (e) {
            console.error("❌ PortOne API Error:", e.message);
        }

        if (!paymentData) {
            console.error("❌ Valid payment not found in PortOne. Cannot sync.");
            process.exit(1);
        }

        console.log("✅ PortOne Data Found:", {
            id: paymentData.id,
            status: paymentData.status,
            amount: paymentData.amount
        });

        // 2. Find in DB (Check paymentKey OR orderId)
        // First check if it already exists with the CORRECT key
        let targetPayment = await db.query.payments.findFirst({
            where: eq(payments.paymentKey, targetKey)
        });

        if (!targetPayment) {
            console.log("⚠️ Not found by correct paymentKey. Checking by orderId or old/wrong key...");
            targetPayment = await db.query.payments.findFirst({
                where: eq(payments.orderId, targetKey)
            });
        }

        if (!targetPayment) {
            console.log("❌ Payment record NOT found in DB even by OrderId.");
            process.exit(0);
        }

        console.log("✅ Found DB Record:", targetPayment);

        // 3. Update DB
        if (paymentData) {
            const status = paymentData.status;
            const amount = typeof paymentData.amount === 'object' ? paymentData.amount.total.toString() : paymentData.amount.toString();
            const customer = paymentData.customer;

            console.log(`Updating DB ID ${targetPayment.id}`);
            console.log(` - Amount: ${amount}`);
            console.log(` - Status: ${status}`);
            // CRITICAL: Update paymentKey to match PortOne's ID
            console.log(` - PaymentKey: ${targetPayment.paymentKey} -> ${paymentData.id}`);

            await db.update(payments).set({
                status: status === 'PAID' ? 'COMPLETED' : status,
                amount: amount,
                paymentKey: paymentData.id, // Correct the key!
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
