
import axios from 'axios';
import crypto from 'crypto';

// Configuration
const PORT = process.env.PORT || 5000;
// We need to use the actual secret if we want to pass signature verification, 
// OR we can rely on the fact that missing secret in env skips verification in dev (if implemented that way).
// Looking at webhook-handler.ts: "if (!WEBHOOK_SECRET) { ... return true; }"
// So we will assume no secret is set in this environment or we provide a dummy one if needed.
const WEBHOOK_URL = `http://localhost:5001/api/portone/webhook`;

async function testWebhook() {
    console.log(`Testing Webhook at ${WEBHOOK_URL}...`);

    // Mock V2 Payload for Payment Completed
    const mockPayload = {
        eventType: 'Transaction.Paid',
        data: {
            payment: {
                status: 'PAID',
                payment_id: 'pay_test_' + Date.now(),
                order_id: 'order_test_' + Date.now(),
                amount: { total: 1000 },
                method: 'CARD',
                requested_at: new Date().toISOString(),
                approved_at: new Date().toISOString()
            }
        },
        timestamp: new Date().toISOString()
    };

    try {
        const response = await axios.post(WEBHOOK_URL, mockPayload, {
            headers: {
                'Content-Type': 'application/json',
                // Optional: Add mock signature headers if we wanted to test that specifically
                // 'portone-signature': '...',
                // 'portone-timestamp': '...' 
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);

        if (response.status === 200) {
            console.log('✅ Webhook test passed: Server accepted the request.');
        } else {
            console.error('❌ Webhook test failed: Server returned unexpected status.');
        }
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Webhook test failed with status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else {
            console.error('❌ Webhook test error:', error.message);
        }
    }
}

testWebhook();
