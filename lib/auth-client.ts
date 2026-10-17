'use client';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthResponse {
  success: boolean;
  data?: {
    accessToken: string;
    user?: AuthUser;
  };
  error?: string;
  errors?: Record<string, string>;
}

class AuthClient {
  private accessToken: string | null = null;
  private user: AuthUser | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  async signup(params: {
    email: string;
    password: string;
    confirmPassword: string;
    name?: string;
    accountName?: string;
    accountType?: "INDIVIDUAL" | "COMPANY";
  }): Promise<AuthResponse> {
    try {
      const res = await axios.post("/api/auth/signup", params, {
        withCredentials: true,
      });

      const data: AuthResponse = res.data;

      if (data.success && data.data) {
        this.accessToken = data.data.accessToken;
        this.user = data.data.user || null;
      }

      return data;
    } catch (error: any) {
      console.error("[Auth] Signup error:", error);
      return {
        success: false,
        error: error?.response?.data?.error || "Network error",
      };
    }
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const res = await axios.post("/api/auth/login", params, {
        withCredentials: true,
      });

      const data: AuthResponse = res.data;

      if (data.success && data.data) {
        this.accessToken = data.data.accessToken;
        this.user = data.data.user || null;
      }

      return data;
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      return {
        success: false,
        error: error?.response?.data?.error || "Network error",
      };
    }
  }

  async refresh(): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      const res = await axios.post(
        "/api/auth/refresh",
        {},
        { withCredentials: true }
      );

      const data: AuthResponse = res.data;

      if (data.success && data.data) {
        this.accessToken = data.data.accessToken;
        return {
          success: true,
          accessToken: data.data.accessToken,
        };
      }

      return {
        success: false,
        error: data.error,
      };
    } catch (error: any) {
      console.error("[Auth] Refresh error:", error);
      return {
        success: false,
        error: "Network error",
      };
    }
  }

  async logout(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const res = await axios.post(
        "/api/auth/logout",
        {},
        { withCredentials: true }
      );

      const data = res.data;

      if (data.success) {
        this.accessToken = null;
        this.user = null;
      }

      return data;
    } catch (error: any) {
      console.error("[Auth] Logout error:", error);
      return {
        success: false,
        error: "Network error",
      };
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  setUser(user: AuthUser | null) {
    this.user = user;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.user;
  }

  // 🔥 MAIN REQUEST METHOD (REPLACES FETCH)
  async request(
    url: string,
    options: AxiosRequestConfig = {}
  ): Promise<AxiosResponse> {
    const makeRequest = () =>
      axios({
        url,
        withCredentials: true,
        ...options,
        headers: {
          ...options.headers,
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
        },
      });

    try {
      return await makeRequest();
    } catch (error: any) {
      // 🔥 HANDLE 401
      if (error.response?.status === 401) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refresh().then((res) => {
            this.refreshPromise = null;
            return res.success;
          });
        }

        const success = await this.refreshPromise;

        if (success) {
          return await makeRequest();
        } else {
          this.accessToken = null;
          this.user = null;
          try { localStorage.removeItem("financial-store"); } catch {}

          if (typeof window !== "undefined") {
            const publicPaths = ["/", "/login", "/signup", "/two-factor"];
            const p = window.location.pathname;
            const isPublic = publicPaths.some((x) => p === x || (x !== "/" && p.startsWith(x)));
            if (!isPublic) window.location.replace("/login");
          }

          throw error;
        }
      }
      if (error.response?.status === 500) {
        console.error('[API 500]', error.response?.data); // log the server response body
      }

      throw error;
    }
  }
}

export const authClient = new AuthClient();
