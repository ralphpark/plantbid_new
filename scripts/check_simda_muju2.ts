
import dotenv from 'dotenv';
dotenv.config();

import { db } from "../server/db";
import { users, storeLocations } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkRecentUsers() {
    console.log(`Listing last 5 users...`);

    const recentUsers = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.id)],
        limit: 5
    });

    for (const user of recentUsers) {
        console.log(`User ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);

        if (user.role === 'vendor') {
            const location = await db.query.storeLocations.findFirst({
                where: eq(storeLocations.userId, user.id)
            });
            if (location) {
                console.log(`  -> Location: Lat=${location.lat}, Lng=${location.lng}, Address=${location.address}`);
            } else {
                console.log(`  -> NO LOCATION RECORD FOUND`);
            }
        }
    }

    process.exit(0);
}

checkRecentUsers();
