import { create } from "zustand"

interface SignupFormData {
  name: string
  email: string
  password: string
  dateOfBirth: string
  idVerified: boolean
  termsAccepted: boolean
}

interface SignupStore {
  currentStep: number
  formData: SignupFormData
  hasScrolledToBottom: boolean
  setCurrentStep: (step: number) => void
  updateFormData: (data: Partial<SignupFormData>) => void
  setHasScrolledToBottom: (scrolled: boolean) => void
  resetSignup: () => void
}

const initialFormData: SignupFormData = {
  name: "",
  email: "",
  password: "",
  dateOfBirth: "",
  idVerified: false,
  termsAccepted: false,
}

export const useSignupStore = create<SignupStore>((set) => ({
  currentStep: 0,
  formData: initialFormData,
  hasScrolledToBottom: false,
  setCurrentStep: (step) => set({ currentStep: step }),
  updateFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  setHasScrolledToBottom: (scrolled) => set({ hasScrolledToBottom: scrolled }),
  resetSignup: () =>
    set({
      currentStep: 0,
      formData: initialFormData,
      hasScrolledToBottom: false,
    }),
}))
