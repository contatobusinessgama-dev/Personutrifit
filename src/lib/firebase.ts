import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
try {
  auth.useDeviceLanguage();
} catch {
  // Ignore language setup failure in restricted environments
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let persistenceReadyPromise: Promise<void> | null = null;

/**
 * Ensures Firebase Auth uses browserLocalPersistence (desktop + mobile),
 * silently falling back if storage is restricted by an embedded WebView/iframe.
 */
export function ensureLocalAuthPersistence(): Promise<void> {
  if (!persistenceReadyPromise) {
    persistenceReadyPromise = setPersistence(auth, browserLocalPersistence).catch(
      () => {}
    );
  }
  return persistenceReadyPromise;
}

void ensureLocalAuthPersistence();

export function validateFirebaseAuthConfig(): {
  valid: boolean;
  missingFields: string[];
  projectId: string;
  authDomain: string;
} {
  const missingFields: string[] = [];
  const apiKey = (firebaseConfig.apiKey || "").trim();
  const authDomain = (firebaseConfig.authDomain || "").trim();
  const projectId = (firebaseConfig.projectId || "").trim();

  if (!apiKey || apiKey.includes("YOUR_") || apiKey.includes("MY_")) {
    missingFields.push("apiKey");
  }
  if (!authDomain || authDomain.includes("remixed-project-id")) {
    missingFields.push("authDomain");
  }
  if (!projectId || projectId === "remixed-project-id") {
    missingFields.push("projectId");
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    projectId,
    authDomain,
  };
}

export function formatPasswordAuthError(
  err: unknown,
  mode: "login" | "register"
): {
  code: string;
  rawMessage: string;
  friendly: string;
} {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code || "")
      : "";
  const rawMessage = err instanceof Error ? err.message : String(err || "");
  const lower = rawMessage.toLowerCase();

  let friendly =
    mode === "register"
      ? "Não foi possível concluir seu cadastro. Verifique os dados e tente novamente."
      : "Não foi possível entrar agora. Verifique seus dados e tente novamente.";

  if (
    code === "auth/network-request-failed" ||
    lower.includes("network-request-failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("offline")
  ) {
    friendly =
      "Falha de conexão: verifique sua internet e tente novamente.";
  } else if (code === "auth/user-disabled" || lower.includes("user-disabled")) {
    friendly = "Esta conta foi desabilitada pelo administrador.";
  } else if (
    code === "auth/too-many-requests" ||
    lower.includes("too-many-requests")
  ) {
    friendly =
      "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
  } else if (
    code === "auth/operation-not-allowed" ||
    lower.includes("operation-not-allowed")
  ) {
    friendly =
      "O cadastro por e-mail e senha está temporariamente indisponível. Contate o administrador.";
  } else if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    lower.includes("invalid-credential") ||
    lower.includes("wrong-password") ||
    lower.includes("user-not-found")
  ) {
    friendly = "E-mail/usuário ou senha incorretos.";
  } else if (
    code === "auth/email-already-in-use" ||
    lower.includes("email-already-in-use")
  ) {
    friendly = "Este e-mail ou nome de usuário já está em uso.";
  } else if (code === "auth/weak-password" || lower.includes("weak-password")) {
    friendly = "A senha precisa ter pelo menos 6 caracteres.";
  } else if (code === "auth/invalid-email" || lower.includes("invalid-email")) {
    friendly = "Informe um e-mail válido (ex: nome@email.com) ou um usuário sem espaços.";
  }

  return { code, rawMessage, friendly };
}

export function formatGoogleAuthError(err: unknown): {
  code: string;
  rawMessage: string;
  friendly: string;
  cancelled: boolean;
  shouldFallbackToRedirect: boolean;
} {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code || "")
      : "";
  const rawMessage = err instanceof Error ? err.message : String(err || "");
  const lower = rawMessage.toLowerCase();

  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    lower.includes("popup-closed-by-user") ||
    lower.includes("cancelled-popup-request")
  ) {
    return {
      code,
      rawMessage,
      friendly: "Login com Google cancelado.",
      cancelled: true,
      shouldFallbackToRedirect: false,
    };
  }

  if (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    lower.includes("popup-blocked")
  ) {
    return {
      code,
      rawMessage,
      friendly: "O navegador bloqueou a janela do Google. Redirecionando para concluir o login...",
      cancelled: false,
      shouldFallbackToRedirect: true,
    };
  }

  let friendly = "Não foi possível entrar com o Google agora. Tente novamente ou use e-mail e senha.";

  if (
    code === "auth/unauthorized-domain" ||
    lower.includes("unauthorized-domain")
  ) {
    const host = typeof window !== "undefined" ? window.location.hostname : "este domínio";
    friendly = `O domínio "${host}" precisa estar autorizado em Firebase Console → Authentication → Settings → Authorized domains.`;
  } else if (
    code === "auth/operation-not-allowed" ||
    lower.includes("operation-not-allowed")
  ) {
    friendly = "O login com Google não está ativado no Firebase Authentication.";
  } else if (
    code === "auth/network-request-failed" ||
    lower.includes("network-request-failed") ||
    lower.includes("failed to fetch")
  ) {
    friendly = "Falha de conexão: verifique sua internet e tente novamente.";
  } else if (
    code === "auth/account-exists-with-different-credential" ||
    lower.includes("account-exists-with-different-credential")
  ) {
    friendly = "Já existe uma conta com este e-mail usando outro método. Entre com e-mail e senha.";
  } else if (code === "auth/user-disabled" || lower.includes("user-disabled")) {
    friendly = "Esta conta foi desabilitada pelo administrador.";
  }

  return {
    code,
    rawMessage,
    friendly,
    cancelled: false,
    shouldFallbackToRedirect: false,
  };
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();
