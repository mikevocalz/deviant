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

    let useStaticContent = true;

    try {
      // Fetch from CMS API
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/legal/${slug}`);
        
        if (response.ok) {
          const data = await response.json();
          // Validate that data has required fields (content is essential)
          if (data && !data.error && data.content && typeof data.content === "string" && data.content.trim().length > 0) {
            set((s) => ({
              pages: { ...s.pages, [slug]: data as LegalPageWithFAQ },
              loading: { ...s.loading, [slug]: false },
            }));
            return; // Successfully loaded from API
          } else {
            console.log("[LegalStore] API response missing content field, using static content");
          }
        } else {
          console.log("[LegalStore] API response not ok:", response.status, "using static content");
        }
      } else {
        console.log("[LegalStore] No API URL configured, using static content");
      }
    } catch (apiError) {
      console.log("[LegalStore] API fetch failed, using static content:", apiError);
    }

    // Fall back to static content
    const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];

    if (staticContent) {
      set((s) => ({
        pages: { ...s.pages, [slug]: staticContent as LegalPageWithFAQ },
        loading: { ...s.loading, [slug]: false },
      }));
    } else {
      set((s) => ({
        loading: { ...s.loading, [slug]: false },
        errors: { ...s.errors, [slug]: "Page not found" },
      }));
    }
  },

  getPage: (slug: LegalPageSlug) => get().pages[slug],
  isLoading: (slug: LegalPageSlug) => get().loading[slug],
  getError: (slug: LegalPageSlug) => get().errors[slug],
}));
