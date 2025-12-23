import 'dotenv/config';
import { db } from "../server/db";
import { payments, orders } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkPayment() {


    const targetId = 'pay_UYm5bGn0lrtJmUFKY2KqYa';
    console.log(`Checking Order/Payment for ID: ${targetId}`);

    try {
        // 1. Check Orders
        const orderResults = await db.select().from(orders).where(eq(orders.orderId, targetId));
        const order = orderResults[0];

        if (order) {
            console.log("✅ Order found:", JSON.stringify(order, null, 2));

            // 2. Check Payments linked to this order
            const paymentResults = await db.select().from(payments).where(eq(payments.orderId, targetId));
            if (paymentResults.length > 0) {
                console.log("✅ Linked Payment found:", JSON.stringify(paymentResults[0], null, 2));
            } else {
                console.log("❌ No payment linked to this order.");
            }
        } else {
            console.log("❌ Order not found.");
            // Try payment key
            const paymentResults = await db.select().from(payments).where(eq(payments.paymentKey, targetId));
            if (paymentResults.length > 0) {
                console.log("✅ Payment found by Key:", JSON.stringify(paymentResults[0], null, 2));
            } else {
                console.log("❌ Payment not found by Key either.");
            }
        }

    } catch (error) {
        console.error("Error querying database:", error);
    }
    process.exit(0);
}

checkPayment();
