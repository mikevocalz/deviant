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

    // Don't refetch if already loaded
    if (state.pages[slug] || state.loading[slug]) {
      return;
    }

    set((s) => ({
      loading: { ...s.loading, [slug]: true },
      errors: { ...s.errors, [slug]: null },
    }));

    try {
      const response = await fetch(`/api/legal/${slug}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${slug}`);
      }

      const data = await response.json();

      set((s) => ({
        pages: { ...s.pages, [slug]: data },
        loading: { ...s.loading, [slug]: false },
      }));
    } catch (error) {
      set((s) => ({
        loading: { ...s.loading, [slug]: false },
        errors: {
          ...s.errors,
          [slug]: error instanceof Error ? error.message : "Failed to load",
        },
      }));
    }
  },

  getPage: (slug: LegalPageSlug) => get().pages[slug],
  isLoading: (slug: LegalPageSlug) => get().loading[slug],
  getError: (slug: LegalPageSlug) => get().errors[slug],
}));
