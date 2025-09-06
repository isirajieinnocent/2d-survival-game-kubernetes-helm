import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// Import OpenAuth client helpers
import { createClient /*, OAuthClient */ } from '@openauthjs/openauth/client'; 
import { parseJwt } from '../utils/auth/jwt'; // Corrected import path

// --- Configuration ---
// Using your domain with /auth path (ingress strips /auth prefix)
const AUTH_SERVER_URL = 'https://play.text2banger.fun/auth';
const OIDC_CLIENT_ID = 'vibe-survival-game-client';
const REDIRECT_URI = 'https://play.text2banger.fun/callback';
const LOCAL_STORAGE_KEYS = {
    ID_TOKEN: 'oidc_id_token',
    ACCESS_TOKEN: 'oidc_access_token',
    REFRESH_TOKEN: 'oidc_refresh_token',
    PKCE_VERIFIER: 'pkce_verifier',
};

interface UserProfile {
    userId: string; // Extracted from id_token subject
}

interface AuthContextType {
  userProfile: UserProfile | null;
  spacetimeToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  loginRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  handleRedirectCallback: () => Promise<void>;
  invalidateCurrentToken: () => void;
}

const AuthContext = createContext<AuthContextType>({
  userProfile: null,
  spacetimeToken: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  loginRedirect: async () => { console.warn("AuthContext not initialized"); },
  logout: async () => { console.warn("AuthContext not initialized"); },
  handleRedirectCallback: async () => { console.warn("AuthContext not initialized"); },
  invalidateCurrentToken: () => { console.warn("AuthContext not initialized"); },
});

interface AuthProviderProps {
  children: ReactNode;
}

// Helper function for Base64URL encoding in browser
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    const base64 = window.btoa(binary);
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Helper function for PKCE using Web Crypto API
async function generatePkceChallenge(verifier: string): Promise<{ code_verifier: string; code_challenge: string; code_challenge_method: string }> {
    const code_verifier = verifier;
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const code_challenge = arrayBufferToBase64Url(digest);
    return {
        code_verifier,
        code_challenge,
        code_challenge_method: 'S256'
    };
}

function generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [spacetimeToken, setSpacetimeToken] = useState<string | null>(() => {
      const storedToken = localStorage.getItem(LOCAL_STORAGE_KEYS.ID_TOKEN);
      console.log(`[AuthContext LOG] Initializing token state. Found in storage: ${!!storedToken}`);
      return storedToken;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [oidcClient] = useState(() => createClient({
      issuer: AUTH_SERVER_URL,
      clientID: OIDC_CLIENT_ID,
  }));

  const loginRedirect = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
        console.log("[AuthContext] Initiating login redirect manually for password flow...");
        
        // 1. Generate PKCE Verifier and Challenge
        const verifier = generateRandomString(128);
        const pkce = await generatePkceChallenge(verifier);
        localStorage.setItem(LOCAL_STORAGE_KEYS.PKCE_VERIFIER, pkce.code_verifier);

        // 2. Generate State
        const state = generateRandomString(32);

        // 3. Construct Authorization URL - NOTE: Ingress strips /auth prefix
        // Original: /auth/password/login → becomes /password/login after ingress rewrite
        const authUrl = new URL('/password/login', AUTH_SERVER_URL);
        authUrl.searchParams.set('client_id', OIDC_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', pkce.code_challenge);
        authUrl.searchParams.set('code_challenge_method', pkce.code_challenge_method);
        authUrl.searchParams.set('acr_values', 'pwd');

        console.log("[AuthContext] Redirecting to manually constructed URL:", authUrl.toString());
        window.location.assign(authUrl.toString());

    } catch (error: any) {
        console.error("[AuthContext] Error initiating manual login redirect:", error);
        setAuthError(error.message || "Failed to start login process");
        setIsLoading(false);
    }
  }, []);

  const handleRedirectCallback = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    console.log("[AuthContext LOG] START: Handling redirect callback...");

    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");
    const state = queryParams.get("state");

    window.history.replaceState({}, document.title, window.location.pathname);

    if (!code) {
        console.warn("[AuthContext] No authorization code found in callback URL.");
        const error = queryParams.get("error");
        const errorDesc = queryParams.get("error_description");
        if (error) {
             setAuthError(`Authentication failed: ${error} ${errorDesc ? `(${errorDesc})` : ''}`);
        } else {
            const existingToken = localStorage.getItem(LOCAL_STORAGE_KEYS.ID_TOKEN);
            if (existingToken) {
                 console.log("[AuthContext] No code in URL, but found existing token.");
                 setSpacetimeToken(existingToken);
                 const profile = parseToken(existingToken);
                 setUserProfile(profile);
            } else {
                console.log("[AuthContext] No code and no existing token.");
            }
        }
        setIsLoading(false);
        console.log("[AuthContext LOG] END: No code found in redirect callback.");
        return;
    }

    const verifier = localStorage.getItem(LOCAL_STORAGE_KEYS.PKCE_VERIFIER);
    if (!verifier) {
        console.error("[AuthContext] PKCE verifier missing from storage.");
        setAuthError("Authentication context lost. Please try logging in again.");
        setIsLoading(false);
        console.log("[AuthContext LOG] END: PKCE verifier missing.");
        return;
    }
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PKCE_VERIFIER);

    try {
        console.log("[AuthContext LOG] Exchanging code for tokens...");
        
        const tokenRequestBody = new URLSearchParams();
        tokenRequestBody.append('grant_type', 'authorization_code');
        tokenRequestBody.append('code', code!);
        tokenRequestBody.append('redirect_uri', REDIRECT_URI);
        tokenRequestBody.append('client_id', OIDC_CLIENT_ID);
        tokenRequestBody.append('code_verifier', verifier);

        // NOTE: /token endpoint remains the same (no /auth prefix in original)
        const tokenResponse = await fetch(`${AUTH_SERVER_URL}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenRequestBody.toString(),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("[AuthContext] Token exchange failed:", tokens);
            const errorDescription = tokens.error_description || tokens.error || `HTTP status ${tokenResponse.status}`;
            throw new Error(`Token exchange failed: ${errorDescription}`);
        }
        
        const id_token = tokens.id_token as string | undefined;
        const access_token = tokens.access_token as string | undefined;
        const refresh_token = tokens.refresh_token as string | undefined;
        
        console.log("[AuthContext LOG] Tokens received (id_token present?):", !!id_token);

        if (!id_token) {
             throw new Error("id_token missing from token response");
        }

        localStorage.setItem(LOCAL_STORAGE_KEYS.ID_TOKEN, id_token);
        if (access_token) localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, access_token);
        if (refresh_token) localStorage.setItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN, refresh_token);

        console.log("[AuthContext LOG] Setting spacetimeToken state AFTER successful callback.");
        setSpacetimeToken(id_token);
        const profile = parseToken(id_token);
        setUserProfile(profile);
        setAuthError(null);

        console.log("[AuthContext LOG] END: Callback handled successfully, redirecting to '/'...");
        window.location.replace('/');

    } catch (error: any) {
        console.error("[AuthContext] Error handling redirect callback:", error);
        setAuthError(error.message || "Failed to process login callback");
        clearTokens();
        setSpacetimeToken(null);
        setUserProfile(null);
        console.log("[AuthContext LOG] END: Error during callback handling.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log("[AuthContext LOG] Logging out...");
    setIsLoading(true);
    clearTokens();
    setSpacetimeToken(null);
    setUserProfile(null);
    setAuthError(null);
    console.log("[AuthContext LOG] Cleared state and tokens for logout.");
    setIsLoading(false); 
    window.location.assign(window.location.origin); 
  }, []);

  const clearTokens = () => {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ID_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PKCE_VERIFIER);
      setSpacetimeToken(null); 
      setUserProfile(null);
      console.log("[AuthContext LOG] Cleared tokens from storage AND state.");
  };

  const parseToken = (token: string): UserProfile | null => {
       try {
            const decoded = parseJwt(token);
            const userId = decoded.sub || decoded.userId; 
            if (!userId) {
                 console.error("Could not find userId (sub or userId) in token payload:", decoded);
                 return null;
            }
            return { userId: userId };
       } catch (error) {
            console.error("Error parsing token:", error);
            return null;
       }
  };

  const invalidateCurrentToken = useCallback(() => {
    console.warn("[AuthContext LOG] Current token is being invalidated, likely due to rejection by a service (e.g., SpacetimeDB).");
    const tokenExistedPriorToInvalidation = !!localStorage.getItem(LOCAL_STORAGE_KEYS.ID_TOKEN);
    
    clearTokens();

    if (tokenExistedPriorToInvalidation) {
        setAuthError("Your session was rejected or has expired.");
    } else {
        console.warn("[AuthContext LOG] invalidateCurrentToken called, but no token was present in storage to invalidate.");
    }
    setIsLoading(false);
  }, [setAuthError, setIsLoading]);

  useEffect(() => {
    if (window.location.pathname === new URL(REDIRECT_URI).pathname) {
      console.log("[AuthContext LOG] Initial Load: Detected callback URL, invoking handler..."); 
      handleRedirectCallback();
    } else {
      if (spacetimeToken) { 
          console.log("[AuthContext LOG] Initial Load: Token was pre-loaded from storage. Parsing profile.");
          const profile = parseToken(spacetimeToken);
          if (profile) {
              setUserProfile(profile);
              console.log("[AuthContext LOG] Initial Load: Profile parsed successfully.");
          } else {
              console.error("[AuthContext LOG] Initial Load: Failed to parse pre-loaded token. Clearing token.");
              clearTokens();
          }
      } else {
         console.log("[AuthContext LOG] Initial Load: No token was pre-loaded from storage."); 
      }
      setIsLoading(false);
    }
  }, [handleRedirectCallback]);

  useEffect(() => {
    console.log("[AuthContext LOG] spacetimeToken STATE CHANGED to:", spacetimeToken ? `token starting with ${spacetimeToken.substring(0, 10)}...` : null);
  }, [spacetimeToken]); 

  const isAuthenticated = !!spacetimeToken;

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        spacetimeToken,
        isLoading,
        isAuthenticated,
        authError,
        loginRedirect,
        logout,
        handleRedirectCallback,
        invalidateCurrentToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);