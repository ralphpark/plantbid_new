import axios from 'axios';
import { Request, Response } from 'express';
import { db } from './db.js';
import { storeLocations, users, products, vendors as vendorsTable } from '../shared/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { PORTONE_STORE_ID, PORTONE_CHANNEL_KEY } from './portone-v2-client.js';

// Google Maps API 키
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 디버깅을 위한 로깅
console.log('Map API Keys:');
console.log('Google Maps API Key length:', GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.length : 0);

// Google Maps API 설정 가져오기
export function getMapConfig(req: Request, res: Response) {
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'Google Maps API key is not configured' });
  }

  return res.json({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    storeId: PORTONE_STORE_ID,
    channelKey: PORTONE_CHANNEL_KEY
  });
}

// 지오코딩 헬퍼 함수 - 여러 결과 반환
export async function geocodeAddressList(address: string): Promise<Array<{
  lat: number;
  lng: number;
  postal_code: string;
  formatted_address: string;
  place_id?: string;
  types?: string[];
}>> {
  if (!address || !GOOGLE_MAPS_API_KEY) return [];

  try {
    console.log(`구글 지도 지오코딩 요청 (List): "${address}"`);
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address,
        key: GOOGLE_MAPS_API_KEY,
        language: 'ko',
        region: 'kr',
        components: 'country:KR'
      }
    });

    const result = response.data;

    if (result.status === 'OK' && result.results && result.results.length > 0) {
      return result.results.map((item: any) => {
        const location = item.geometry.location;
        let postal_code = '';
        if (item.address_components) {
          for (const component of item.address_components) {
            if (component.types.includes('postal_code')) {
              postal_code = component.long_name;
              break;
            }
          }
        }
        return {
          lat: location.lat,
          lng: location.lng,
          postal_code,
          formatted_address: item.formatted_address,
          place_id: item.place_id,
          types: item.types
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Geocoding list helper error:', error);
    return [];
  }
}

// 지오코딩 헬퍼 함수 - 단일 결과 반환 (기존 호환성 유지)
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  postal_code: string;
  formatted_address: string;
} | null> {
  const results = await geocodeAddressList(address);
  if (results.length > 0) {
    return results[0];
  }
  return null;
}


// 텍스트로 장소 검색 (Places Text Search API 사용) - 중복 지명 처리에 더 효과적
export async function searchPlacesByText(query: string): Promise<Array<{
  geometry: { location: { lat: number; lng: number } };
  formatted_address: string;
  name: string;
  place_id: string;
  types?: string[];
}>> {
  if (!query || !GOOGLE_MAPS_API_KEY) return [];

  // 쿼리가 너무 짧으면 빈 결과 반환
  if (query.length < 2) return [];

  try {
    console.log(`구글 Places Text Search 요청: "${query}"`);
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: query,
        key: GOOGLE_MAPS_API_KEY,
        language: 'ko',
        region: 'kr', // 한국 우선 검색
      }
    });

    const result = response.data;

    if (result.status === 'OK' && result.results && result.results.length > 0) {
      // 결과 매핑
      return result.results.map((item: any) => ({
        geometry: item.geometry,
        formatted_address: item.formatted_address,
        name: item.name,
        place_id: item.place_id,
        types: item.types
      }));
    } else {
      console.log(`Places Text Search 결과 없음: ${result.status}`);

      // 결과가 없거나 ZERO_RESULTS인 경우 기존 Geocoding API로 폴백(Fallback) 시도
      // Geocoding API는 특정 주소 포맷에 더 강할 수 있음
      if (result.status === 'ZERO_RESULTS') {
        console.log('Geocoding API로 재시도합니다...');
        const geocodeResults = await geocodeAddressList(query);
        return geocodeResults.map(item => ({
          geometry: { location: { lat: item.lat, lng: item.lng } },
          formatted_address: item.formatted_address,
          name: item.formatted_address, // Geocoding 결과는 name 필드가 없으므로 주소 사용
          place_id: item.place_id || '',
          types: item.types
        }));
      }

      return [];
    }
  } catch (error) {
    console.error('Places Text Search error:', error);
    // 에러 발생 시 빈 배열 반환 (호출 측에서 처리)
    return [];
  }
}


// 주소 검색 (Places Text Search API + Geocoding Fallback)
export async function searchAddressByQuery(req: Request, res: Response) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: '검색어가 필요합니다.' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'Google Maps API key is not configured' });
  }

  try {
    // 1. Places Text Search API 호출 (우선)
    const results = await searchPlacesByText(query as string);

    if (results.length > 0) {
      return res.json({
        success: true,
        results: results
      });
    } else {
      // 2. 결과가 없으면(searchPlacesByText 내부에서 Geocoding도 실패한 경우)
      return res.json({
        success: false,
        error: '검색 결과가 없습니다.'
      });
    }
  } catch (error) {
    console.error('Search address error:', error);
    return res.status(500).json({
      success: false,
      error: '주소 검색 중 오류가 발생했습니다.'
    });
  }
}

// 좌표로 주소 검색 (역지오코딩)
export async function getAddressByCoords(req: Request, res: Response) {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: '위도와 경도가 필요합니다.' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'Google Maps API key is not configured' });
  }

  try {
    console.log(`구글 지도 역지오코딩 API 호출 - 좌표: ${lat},${lng}`);
    console.log('GOOGLE_MAPS_API_KEY:', GOOGLE_MAPS_API_KEY ? '설정됨' : '미설정');

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_API_KEY,
        language: 'ko' // 한국어로 결과 받기
      }
    });

    // 결과 확인
    const result = response.data;
    console.log('역지오코딩 응답 상태:', result.status);

    if (result.status === 'OK' && result.results && result.results.length > 0) {
      // 결과 데이터 정리
      const results = result.results.map((item: any) => {
        // 우편번호 찾기
        let postal_code = '';
        if (item.address_components) {
          for (const component of item.address_components) {
            if (component.types.includes('postal_code')) {
              postal_code = component.long_name;
              break;
            }
          }
        }

        return {
          formatted_address: item.formatted_address,
          postal_code: postal_code,
          place_id: item.place_id,
          types: item.types
        };
      });

      return res.json({
        success: true,
        results: results
      });
    } else {
      // 결과가 없는 경우
      return res.json({
        success: false,
        error: '주소를 찾을 수 없습니다.',
        googleStatus: result.status
      });
    }
  } catch (error) {
    console.error('Google reverse geocoding error:', error);
    return res.status(500).json({
      success: false,
      error: '구글 지도 API 호출 중 오류가 발생했습니다.'
    });
  }
}

// 근처 판매자 검색 (반경 내)
export async function findNearbyVendors(req: Request, res: Response) {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: '위도와 경도가 필요합니다.' });
  }

  // 반경이 0이거나 매우 작은 값인 경우 최소 반경 0.2km(200m)로 설정
  let radiusKm = radius ? parseFloat(radius as string) : 5; // 기본 반경 5km
  radiusKm = radiusKm <= 0.2 ? 0.2 : radiusKm; // 최소 반경 보장
  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  console.log(`[findNearbyVendors] Request: lat=${lat}, lng=${lng}, radius=${radius}, radiusKm=${radiusKm}`);

  try {
    // 데이터베이스에서 판매자 위치 정보 가져오기
    // storeLocations 테이블에서 위치 정보 가져오기

    // Haversine 공식을 사용하여 거리를 계산하는 SQL 쿼리
    const nearbyStoreLocations = await db.select({
      id: storeLocations.id,
      userId: storeLocations.userId,
      address: storeLocations.address,
      region: storeLocations.region,
      lat: storeLocations.lat,
      lng: storeLocations.lng,
      radius: storeLocations.radius,
      username: users.username,
      name: users.name,
      vendorId: vendorsTable.id, // 실제 판매자 ID (Orders 연결용)
      vendorStoreName: vendorsTable.storeName,
      // Haversine 공식을 사용하여 거리 계산 (km 단위)
      distance: sql<number>`
        (6371 * acos(LEAST(1.0, GREATEST(-1.0, 
          cos(radians(${userLat})) * 
          cos(radians(${storeLocations.lat})) * 
          cos(radians(${storeLocations.lng}) - 
          radians(${userLng})) + 
          sin(radians(${userLat})) * 
          sin(radians(${storeLocations.lat}))
        ))))`.as('distance')
    })
      .from(storeLocations)
      .leftJoin(users, eq(storeLocations.userId, users.id))
      .leftJoin(vendorsTable, eq(users.id, vendorsTable.userId)) // Fix: vendors.id -> vendors.userId
      .where(
        // 판매자 역할을 가진 사용자만 선택
        and(
          eq(users.role, 'vendor'),
          // 사용자의 서비스 반경보다 작은 거리에 있는 판매자만 선택
          sql<boolean>`
          (6371 * acos(LEAST(1.0, GREATEST(-1.0, 
            cos(radians(${userLat})) * 
            cos(radians(${storeLocations.lat})) * 
            cos(radians(${storeLocations.lng}) - 
            radians(${userLng})) + 
            sin(radians(${userLat})) * 
            sin(radians(${storeLocations.lat}))
          )))) <= ${radiusKm}`
        )
      )
      .orderBy(sql`distance`);

    console.log(`검색된 판매자 수: ${nearbyStoreLocations.length} (반경: ${radiusKm}km)`);
    if (nearbyStoreLocations.length > 0) {
      console.log('검색된 판매자 정보:', nearbyStoreLocations.map(store => ({
        id: store.vendorId, // Log real vendor ID
        userId: store.userId,
        name: store.name || store.username,
        distance: Number(store.distance.toFixed(1))
      })));
    }

    // 결과 변환
    const vendorResults = [];

    // 판매자별로 상품 정보 추가
    for (const store of nearbyStoreLocations) {
      // 해당 판매자의 상품 정보 가져오기
      const vendorProducts = await db.select()
        .from(products)
        .where(
          and(
            eq(products.userId, store.userId),
            eq(products.onlineStoreVisible, true) // 온라인 상점 노출용으로 설정된 상품만 가져오기
          )
        );

      vendorResults.push({
        id: store.vendorId || store.userId, // Fix: Use vendorId from vendors table (fallback to userId only if null)
        userId: store.userId, // Keep track of userId explicitly
        name: store.name || store.username || '이름 없음',
        storeName: store.vendorStoreName || `${store.name || store.username} 상점`,
        address: store.address,
        distance: Number(store.distance.toFixed(1)),
        lat: Number(store.lat),
        lng: Number(store.lng),
        region: store.region,
        products: vendorProducts, // 판매자의 상품 정보 추가
      });
    }

    return res.json({
      vendors: vendorResults,
      center: { lat: userLat, lng: userLng },
      radius: radiusKm,
    });

  } catch (error) {
    console.error('Find nearby vendors error:', error);
    return res.status(500).json({ error: '판매자 검색 중 오류가 발생했습니다.' });
  }
}