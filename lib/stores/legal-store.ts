import { create } from "zustand";
import { LEGAL_CONTENT } from "@/lib/constants/legal-content";

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

    // Try API first (which has its own CMS -> static fallback)
    const API_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";
    const apiUrl = API_BASE_URL ? `${API_BASE_URL}/api/legal/${slug}` : `/api/legal/${slug}`;

    try {
      console.log("[LegalStore] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: API_BASE_URL ? "omit" : "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data && !data.error && data.content) {
          console.log("[LegalStore] ✓ Loaded for:", slug);
          set((s) => ({
            pages: { ...s.pages, [slug]: data as LegalPageWithFAQ },
            loading: { ...s.loading, [slug]: false },
            errors: { ...s.errors, [slug]: null },
          }));
          return;
        }
      }
    } catch (error: any) {
      console.log("[LegalStore] API fetch failed, using local fallback:", error?.message);
    }

    // Final fallback to local static content
    const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];
    if (staticContent) {
      console.log("[LegalStore] ✓ Using local static content for:", slug);
      set((s) => ({
        pages: { ...s.pages, [slug]: staticContent as LegalPageWithFAQ },
        loading: { ...s.loading, [slug]: false },
        errors: { ...s.errors, [slug]: null },
      }));
      return;
    }

    // No content available
    set((s) => ({
      loading: { ...s.loading, [slug]: false },
      errors: { ...s.errors, [slug]: "Content not available" },
    }));
  },

  getPage: (slug: LegalPageSlug) => get().pages[slug],
  isLoading: (slug: LegalPageSlug) => get().loading[slug],
  getError: (slug: LegalPageSlug) => get().errors[slug],
}));
