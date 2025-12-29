
import { config } from 'dotenv';
import { Client } from "@googlemaps/google-maps-services-js";

config();

const client = new Client({});

async function getCoords(address: string) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error("GOOGLE_MAPS_API_KEY not found");
    }
    const args = {
        params: {
            key: process.env.GOOGLE_MAPS_API_KEY,
            address: address,
            region: 'kr',
        },
    };
    const res = await client.geocode(args);
    if (res.data.results.length > 0) {
        const loc = res.data.results[0].geometry.location;
        console.log(`Address: "${address}" found at ${loc.lat}, ${loc.lng}`);
        console.log(`Formatted Address: ${res.data.results[0].formatted_address}`);
        return loc;
    } else {
        console.error(`Address not found: ${address}`);
        return null;
    }
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

async function main() {
    const searchAddress = "경상남도 거제시 장목면 거가대로";
    const vendorAddress = "부산 강서구 거가대로 2571";

    console.log("Checking distance...");

    const p1 = await getCoords(searchAddress);
    const p2 = await getCoords(vendorAddress);

    if (p1 && p2) {
        const dist = getDistanceFromLatLonInKm(p1.lat, p1.lng, p2.lat, p2.lng);
        console.log(`Distance: ${dist.toFixed(4)} km`);
        const radius = 9.8;
        if (dist > radius) {
            console.log(`RESULT: OUT OF RANGE. Distance (${dist.toFixed(2)}km) > Radius (${radius}km)`);
        } else {
            console.log(`RESULT: IN RANGE. Distance (${dist.toFixed(2)}km) <= Radius (${radius}km)`);
        }
    }
}

main();
