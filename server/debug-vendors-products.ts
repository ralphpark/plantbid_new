import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { vendors, products, users } from '../shared/schema.js';

const connectionString = process.env.SUPABASE_DB_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function debugVendorsProducts() {
  console.log('\n========== 판매자와 상품 관계 디버깅 ==========\n');

  try {
    // 1. 모든 판매자 조회
    const allVendors = await db.select().from(vendors);
    console.log(`📊 전체 판매자 수: ${allVendors.length}명\n`);

    console.log('👥 [판매자 목록]');
    allVendors.forEach(v => {
      console.log(`  - ${v.storeName}`);
      console.log(`    vendors.id: ${v.id}`);
      console.log(`    vendors.userId: ${v.userId || 'NULL'}`);
      console.log(`    주소: ${v.address}`);
      console.log(`    위도/경도: ${v.latitude}, ${v.longitude}`);
      console.log('');
    });

    // 2. 모든 상품 조회
    const allProducts = await db.select().from(products);
    console.log(`\n📦 전체 상품 수: ${allProducts.length}개\n`);

    console.log('🛍️  [상품 목록]');
    allProducts.forEach(p => {
      console.log(`  - "${p.name}" (products.id: ${p.id})`);
      console.log(`    products.userId: ${p.userId}`);
      console.log(`    재고: ${p.stock}`);
      console.log(`    가격: ${p.price}원`);
      console.log('');
    });

    // 3. 판매자별 상품 매칭 분석
    console.log('\n🔗 [판매자-상품 매칭 분석]\n');

    for (const vendor of allVendors) {
      // vendors.userId로 상품 찾기
      const vendorProducts = allProducts.filter(p => p.userId === vendor.userId);

      console.log(`판매자: ${vendor.storeName} (vendors.id: ${vendor.id}, userId: ${vendor.userId || 'NULL'})`);
      if (vendorProducts.length > 0) {
        console.log(`  ✅ 등록된 상품: ${vendorProducts.length}개`);
        vendorProducts.forEach(p => {
          console.log(`    - ${p.name} (재고: ${p.stock}, 가격: ${p.price}원)`);
        });
      } else {
        console.log(`  ⚠️  등록된 상품 없음`);
        if (vendor.userId === null) {
          console.log(`     원인: vendors.userId가 NULL - users 테이블과 연결 안됨`);
        } else {
          console.log(`     원인: products.userId=${vendor.userId}인 상품이 없음`);
        }
      }
      console.log('');
    }

    // 4. users 테이블에서 role='vendor'인 사용자 확인
    const allUsers = await db.select().from(users);
    const vendorUsers = allUsers.filter(u => u.role === 'vendor');

    console.log(`\n👤 [users 테이블의 판매자 (role=vendor)]\n`);
    console.log(`총 ${vendorUsers.length}명\n`);

    vendorUsers.forEach(u => {
      console.log(`  - ${u.username} (users.id: ${u.id})`);
      console.log(`    email: ${u.email}`);
      console.log(`    storeName: ${u.storeName || 'NULL'}`);
      console.log(`    address: ${u.address || 'NULL'}`);

      // 이 users.id로 등록된 상품 찾기
      const userProducts = allProducts.filter(p => p.userId === u.id);
      console.log(`    등록된 상품: ${userProducts.length}개`);
      if (userProducts.length > 0) {
        userProducts.forEach(p => {
          console.log(`      - ${p.name}`);
        });
      }

      // 이 users.id를 userId로 가진 vendors 레코드 찾기
      const vendorRecord = allVendors.find(v => v.userId === u.id);
      if (vendorRecord) {
        console.log(`    vendors 테이블 연결: ✅ (vendors.id: ${vendorRecord.id})`);
      } else {
        console.log(`    vendors 테이블 연결: ❌ (연결 안됨)`);
      }
      console.log('');
    });

    // 5. 문제점 요약
    console.log('\n========== 문제점 요약 ==========\n');

    const vendorsWithoutUserId = allVendors.filter(v => !v.userId);
    if (vendorsWithoutUserId.length > 0) {
      console.log(`⚠️  vendors.userId가 NULL인 판매자: ${vendorsWithoutUserId.length}명`);
      vendorsWithoutUserId.forEach(v => {
        console.log(`  - ${v.storeName} (vendors.id: ${v.id})`);
      });
      console.log('');
    }

    const vendorsWithNoProducts = allVendors.filter(v => {
      const products = allProducts.filter(p => p.userId === v.userId);
      return v.userId && products.length === 0;
    });
    if (vendorsWithNoProducts.length > 0) {
      console.log(`⚠️  등록된 상품이 없는 판매자: ${vendorsWithNoProducts.length}명`);
      vendorsWithNoProducts.forEach(v => {
        console.log(`  - ${v.storeName} (userId: ${v.userId})`);
      });
      console.log('');
    }

    const productsWithoutVendor = allProducts.filter(p => {
      return !allVendors.find(v => v.userId === p.userId);
    });
    if (productsWithoutVendor.length > 0) {
      console.log(`⚠️  판매자가 없는 상품: ${productsWithoutVendor.length}개`);
      productsWithoutVendor.forEach(p => {
        console.log(`  - ${p.name} (products.userId: ${p.userId})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('디버깅 중 오류:', error);
  } finally {
    await client.end();
  }
}

debugVendorsProducts();
