import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { normalizeProfileIcon } from "@/lib/profileIcons";
import { requireUserFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

export async function POST(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const db = getAdminDb();
        const userRef = db.collection("users").doc(decodedUser.uid);
        const now = Date.now();
        const existingSnap = await userRef.get();
        const existing = existingSnap.exists ? existingSnap.data() : null;
        const existingPhoto = typeof existing?.photoURL === "string" ? existing.photoURL : "";
        const managedExistingIcon = normalizeProfileIcon(existingPhoto);
        const managedTokenIcon = normalizeProfileIcon(decodedUser.picture);
        const nextPhotoURL = managedExistingIcon || existingPhoto || managedTokenIcon || decodedUser.picture || "";

        await userRef.set(
            {
                uid: decodedUser.uid,
                email: decodedUser.email || existing?.email || "",
                displayName: decodedUser.name || existing?.displayName || "Usuário",
                photoURL: nextPhotoURL,
                createdAt: existing?.createdAt || now,
                updatedAt: now,
                lastSeenAt: now,
            },
            { merge: true }
        );

        return NextResponse.json({ ok: true, lastSeenAt: now });
    } catch (error) {
        const message = normalizeErrorMessage(error).toLowerCase();
        if (message.includes("missing bearer token")) {
            return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
        }
        if (message.includes("verifyidtoken") || message.includes("id token")) {
            return NextResponse.json({ error: "Invalid id token." }, { status: 401 });
        }

        console.error("users presence error:", error);
        return NextResponse.json(
            { error: "Unable to update user presence.", details: normalizeErrorMessage(error) },
            { status: 500 }
        );
    }
}
