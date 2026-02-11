import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function requireUserIdFromRequest(request: NextRequest) {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
        throw new Error("Missing bearer token.");
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
}

