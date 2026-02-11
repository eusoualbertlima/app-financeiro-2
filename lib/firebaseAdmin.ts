import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccountConfig() {
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

