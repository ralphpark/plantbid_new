
import dotenv from 'dotenv';
dotenv.config();

import { geocodeAddress } from "../server/map";

async function checkDistances() {
    const searchTerm = "전북특별자치도 무주군";
    console.log(`검색어: ${searchTerm}`);

    const center = await geocodeAddress(searchTerm);
    if (!center) {
        console.log("검색어 지오코딩 실패");
        return;
    }
    console.log(`중심 좌표: ${center.lat}, ${center.lng}`);

    const vendors = [
        { id: 20, name: "simda_muju", lat: 35.9718696, lng: 127.6529056 },
        { id: 21, name: "simda_muju2", lat: 35.8382056, lng: 127.6541831 }
    ];

    const centerLat = center.lat;
    const centerLng = center.lng;

    vendors.forEach(vendor => {
        const dlat = (vendor.lat - centerLat) * 111;
        const dlng = (vendor.lng - centerLng) * 111 * Math.cos(centerLat * Math.PI / 180);
        const distance = Math.sqrt(dlat * dlat + dlng * dlng);
        console.log(`[${vendor.name}] 거리: ${distance.toFixed(2)} km`);
    });

    process.exit(0);
}

checkDistances();
