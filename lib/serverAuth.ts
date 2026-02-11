import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function requireUserFromRequest(request: NextRequest): Promise<DecodedIdToken> {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
        throw new Error("Missing bearer token.");
    }

    return getAdminAuth().verifyIdToken(token);
}

export async function requireUserIdFromRequest(request: NextRequest) {
    const decoded = await requireUserFromRequest(request);
    return decoded.uid;
}
