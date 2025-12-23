import 'dotenv/config';
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkPayment() {
    const paymentKey = 'pay_G2sIZMK0LUB8x1zbU8xDkH';
    console.log(`Checking payment: ${paymentKey}`);

    try {
        const paymentResults = await db.select().from(payments).where(eq(payments.paymentKey, paymentKey));
        const payment = paymentResults[0];

        if (!payment) {
            console.log("❌ Payment not found in database!");
        } else {
            console.log("✅ Payment found:", JSON.stringify(payment, null, 2));

            if (payment.orderId) {
                const orderResults = await db.select().from(orders).where(eq(orders.orderId, payment.orderId));
                const order = orderResults[0];
                console.log("Order Details:", JSON.stringify(order, null, 2));
            }
        }
    } catch (error) {
        console.error("Error querying database:", error);
    }
    process.exit(0);
}

checkPayment();
