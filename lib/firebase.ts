// Server-only: this module holds service account credentials and must never
// be pulled into a client bundle. Importing it from a Client Component is a
// build-time error.
import "server-only";

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// The Admin SDK authenticates as a service account, so Firestore security
// rules are bypassed entirely. This lets the rules stay locked down
// (`allow read, write: if false`) while the server retains full access.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not configured. Add it to .env.local from your Firebase ` +
        `service account key (Project Settings > Service Accounts > Generate new private key).`
    );
  }
  return value;
}

function getCredentials() {
  // Private keys are stored single-line with escaped newlines in .env files,
  // so they must be expanded back before the PEM can be parsed.
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return cert({
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey,
  });
}

// In dev, hot reload can re-evaluate this module while the underlying Firebase
// app survives. Track whether we actually created it, because `settings()`
// throws if applied twice to an instance that has already been used.
const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp({ credential: getCredentials() }) : getApp();

export const db = getFirestore(app);

if (isFirstInit) {
  // Firestore rejects `undefined` field values by default, which would turn an
  // optional field left blank into a failed save. Dropping them matches how the
  // app already treats absent values.
  db.settings({ ignoreUndefinedProperties: true });
}
