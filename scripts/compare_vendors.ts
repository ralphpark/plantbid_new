
import dotenv from 'dotenv';
dotenv.config();

import { db } from "../server/db";
import { vendors, users } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

async function compareVendors() {
    console.log('판매자 데이터 비교: simda_muju (ID 20) vs simda_muju2 (ID 21)');

    const vendorData = await db
        .select()
        .from(vendors)
        .where(inArray(vendors.id, [20, 21]));

    console.log('--------------------------------------------------');
    vendorData.forEach(v => {
        console.log(`[ID ${v.id}] ${v.storeName} (${v.name})`);
        console.log(`  - Address: ${v.address}`);
        console.log(`  - Coords : ${v.latitude}, ${v.longitude}`);
        console.log(`  - Verified: ${v.isVerified}`);
        console.log(`  - Rating  : ${v.rating}`);
        console.log(`  - UserID  : ${v.userId}`);
    });
    console.log('--------------------------------------------------');

    // 사용자 정보도 확인 (active 상태 등)
    const userIds = vendorData.map(v => v.userId).filter(id => id !== null) as number[];
    const userData = await db.select().from(users).where(inArray(users.id, userIds));

    userData.forEach(u => {
        console.log(`[User ID ${u.id}] ${u.username}`);
        console.log(`  - Role: ${u.role}`);
        // console.log(`  - Active: ${u.isActive}`); // 스키마 확인 필요
    });

    process.exit(0);
}

compareVendors();
