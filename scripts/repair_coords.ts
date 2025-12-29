
import dotenv from 'dotenv';
dotenv.config();

import { db } from "../server/db";
import { users, vendors } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { geocodeAddress } from "../server/map";

async function repairVendorCoordinates() {
    console.log('판매자 좌표 복구 시작...');

    // 좌표가 없는 판매자 찾기
    const vendorsWithoutCoords = await db
        .select()
        .from(vendors)
        .where(
            or(
                isNull(vendors.latitude),
                isNull(vendors.longitude)
            )
        );

    console.log(`좌표가 없는 판매자 ${vendorsWithoutCoords.length}명 발견.`);

    for (const vendor of vendorsWithoutCoords) {
        if (!vendor.address) {
            console.log(`판매자 ID ${vendor.id}: 주소 정보가 없어 건너뜀.`);
            continue;
        }

        // 주소에서 (우편번호) 제거
        const addressToGeocode = vendor.address.split('(')[0].trim();
        console.log(`판매자 ID ${vendor.id} (${vendor.storeName}) 좌표 검색 시도: ${addressToGeocode}`);

        try {
            const coords = await geocodeAddress(addressToGeocode);

            if (coords) {
                console.log(`  -> 좌표 발견: ${coords.lat}, ${coords.lng}`);

                await db
                    .update(vendors)
                    .set({
                        latitude: coords.lat,
                        longitude: coords.lng
                    })
                    .where(eq(vendors.id, vendor.id));

                console.log(`  -> 업데이트 완료.`);
            } else {
                console.log(`  -> 좌표를 찾을 수 없음.`);
            }
        } catch (error) {
            console.error(`  -> 오류 발생:`, error);
        }
    }

    process.exit(0);
}

// Import helper need to be dynamic or we need to copy functionality if we run this as standalone script
// For simplicity in this environment, assuming server/map.ts is importable. 
// However, since we are running via tsx, we need to ensure imports work.
// If server/map.ts has express dependencies, it might be tricky.
// Let's rely on the fact that I just refactored it to be cleaner.

import { or } from "drizzle-orm";

repairVendorCoordinates();
