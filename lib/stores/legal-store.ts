import { create } from "zustand";

export type LegalPageSlug =
  | "about"
  | "privacy-policy"
  | "terms-of-service"
  | "community-standards"
  | "faq"
  | "eligibility"
  | "identity-protection"
  | "ad-policy";

export interface LegalPage {
  id: string;
  slug: LegalPageSlug;
  title: string;
  subtitle?: string;
  content: string;
  lastUpdated: string;
  effectiveDate?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

export interface LegalPageWithFAQ extends LegalPage {
  faqs?: FAQItem[];
}

interface LegalState {
  pages: Record<LegalPageSlug, LegalPageWithFAQ | null>;
  loading: Record<LegalPageSlug, boolean>;
  errors: Record<LegalPageSlug, string | null>;
  fetchPage: (slug: LegalPageSlug) => Promise<void>;
  getPage: (slug: LegalPageSlug) => LegalPageWithFAQ | null;
  isLoading: (slug: LegalPageSlug) => boolean;
  getError: (slug: LegalPageSlug) => string | null;
}

export const useLegalStore = create<LegalState>((set, get) => ({
  pages: {
    about: null,
    "privacy-policy": null,
    "terms-of-service": null,
    "community-standards": null,
    faq: null,
    eligibility: null,
    "identity-protection": null,
    "ad-policy": null,
  },
  loading: {
    about: false,
    "privacy-policy": false,
    "terms-of-service": false,
    "community-standards": false,
    faq: false,
    eligibility: false,
    "identity-protection": false,
    "ad-policy": false,
  },
  errors: {
    about: null,
    "privacy-policy": null,
    "terms-of-service": null,
    "community-standards": null,
    faq: null,
    eligibility: null,
    "identity-protection": null,
    "ad-policy": null,
  },

  fetchPage: async (slug: LegalPageSlug) => {
    const state = get();

    // Don't refetch if already loaded with valid content
    const existingPage = state.pages[slug];
    if (existingPage && existingPage.content && existingPage.content.trim().length > 0) {
      return;
    }
    
    // Don't refetch if currently loading
    if (state.loading[slug]) {
      return;
    }

    set((s) => ({
      loading: { ...s.loading, [slug]: true },
      errors: { ...s.errors, [slug]: null },
    }));

    // Fetch from CMS API - content MUST come from backend
    const API_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";
    const apiUrl = API_BASE_URL ? `${API_BASE_URL}/api/legal/${slug}` : `/api/legal/${slug}`;

    try {
      console.log("[LegalStore] Fetching from CMS:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: API_BASE_URL ? "omit" : "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          console.log("[LegalStore] ✓ Loaded from CMS for:", slug);
          set((s) => ({
            pages: { ...s.pages, [slug]: data as LegalPageWithFAQ },
            loading: { ...s.loading, [slug]: false },
            errors: { ...s.errors, [slug]: null },
          }));
          return;
        }
      }

      // API returned error or non-ok status
      const errorData = await response.json().catch(() => ({}));
      console.error("[LegalStore] CMS returned error:", response.status, errorData);
      set((s) => ({
        loading: { ...s.loading, [slug]: false },
        errors: { ...s.errors, [slug]: errorData.error || "Failed to load content from CMS" },
      }));
    } catch (error: any) {
      console.error("[LegalStore] CMS fetch failed:", error);
      set((s) => ({
        loading: { ...s.loading, [slug]: false },
        errors: { ...s.errors, [slug]: error?.message || "Failed to connect to CMS" },
      }));
    }
  },

  getPage: (slug: LegalPageSlug) => get().pages[slug],
  isLoading: (slug: LegalPageSlug) => get().loading[slug],
  getError: (slug: LegalPageSlug) => get().errors[slug],
}));
