import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const REQUIRED_ADMIN_ENV = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
] as const;

function getMissingAdminEnv() {
    return REQUIRED_ADMIN_ENV.filter((key) => !process.env[key]);
}

function getServiceAccountConfig() {
    const missing = getMissingAdminEnv();
    if (missing.length > 0) {
        return null;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey,
    };
}

export function getFirebaseAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const serviceAccount = getServiceAccountConfig();

    if (serviceAccount) {
        return initializeApp({
            credential: cert(serviceAccount),
        });
    }

    const allowApplicationDefault = process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true";
    if (!allowApplicationDefault) {
        const missing = getMissingAdminEnv();
        throw new Error(
            `Missing Firebase Admin env: ${missing.join(", ")}. Configure these variables in Vercel.`
        );
    }

    return initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
}

export function getAdminDb() {
    return getFirestore(getFirebaseAdminApp());
}

export function getAdminAuth() {
    return getAuth(getFirebaseAdminApp());
}
