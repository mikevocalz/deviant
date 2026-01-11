import { useState, useMemo, useEffect } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useForm } from '@tanstack/react-form'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { router } from 'expo-router'
import { UserPlus, Calendar, FileText, CheckCircle, ArrowLeft } from 'lucide-react-native'
import { FormInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuthStore } from '@/lib/stores/auth-store'

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  
  if (score <= 1) return { level: 'Weak', color: '#ef4444', width: '25%' as const }
  if (score <= 2) return { level: 'Fair', color: '#f97316', width: '50%' as const }
  if (score <= 3) return { level: 'Good', color: '#eab308', width: '75%' as const }
  return { level: 'Strong', color: '#34A2DF', width: '100%' as const }
}

export default function SignupScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const [password, setPassword] = useState('')
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userData, setUserData] = useState({ firstName: '', lastName: '', email: '', password: '' })
  
  const setUser = useAuthStore((state) => state.setUser)
  const strength = useMemo(() => getPasswordStrength(password), [password])

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setUserData({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        password: value.password,
      })
      setCurrentStep(1)
    },
  })

  const handleFinalSubmit = async () => {
    if (!termsAccepted || !hasScrolledToBottom) return
    
    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    const generatedUsername = `${userData.firstName.toLowerCase()}.${userData.lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '')
    setUser({
      id: "1",
      email: userData.email,
      username: generatedUsername,
      name: `${userData.firstName} ${userData.lastName}`,
      isVerified: true,
    })
    
    router.replace('/(protected)/(tabs)' as any)
  }

  const steps = [
    { label: 'Account', icon: UserPlus },
    { label: 'Terms', icon: FileText },
  ]

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} className="bg-background">
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center gap-4 pt-10 px-6">
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-foreground">Create your account</Text>
            <Text className="text-muted-foreground">Complete the steps below to get started</Text>
          </View>
        </View>

        {/* Step Indicator */}
        <View className="flex-row justify-center items-center gap-4 py-6 px-6">
          {steps.map((step, index) => (
            <View key={index} className="flex-row items-center">
              <View 
                className={`h-10 w-10 rounded-full items-center justify-center ${
                  index <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle size={20} color="#fff" />
                ) : (
                  <step.icon size={20} color={index <= currentStep ? '#fff' : '#71717a'} />
                )}
              </View>
              {index < steps.length - 1 && (
                <View className={`h-0.5 w-12 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </View>
          ))}
        </View>

        {/* Step 1: Account Info */}
        {currentStep === 0 && (
          <View className="px-6 py-4 gap-4">
            <View className="flex-row gap-4">
              <View className="flex-1">
                <FormInput
                  form={form}
                  name="firstName"
                  label="First Name"
                  placeholder="John"
                  validators={{
                    onChange: ({ value }: any) => {
                      if (!value) return 'First name is required'
                      if (value.length < 2) return 'Must be at least 2 characters'
                      return undefined
                    },
                  }}
                />
              </View>
              <View className="flex-1">
                <FormInput
                  form={form}
                  name="lastName"
                  label="Last Name"
                  placeholder="Doe"
                  validators={{
                    onChange: ({ value }: any) => {
                      if (!value) return 'Last name is required'
                      if (value.length < 2) return 'Must be at least 2 characters'
                      return undefined
                    },
                  }}
                />
              </View>
            </View>

            <FormInput
              form={form}
              name="email"
              label="Email"
              placeholder="john.doe@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              validators={{
                onChange: ({ value }: any) => {
                  if (!value) return 'Email is required'
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email'
                  return undefined
                },
              }}
            />

            <form.Field name="password">
              {(field) => (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-muted-foreground">Password</Text>
                  <Input
                    value={field.state.value}
                    onChangeText={(text) => {
                      field.handleChange(text)
                      setPassword(text)
                    }}
                    onBlur={field.handleBlur}
                    placeholder="Create a strong password"
                    secureTextEntry
                  />
                  {password.length > 0 && (
                    <View className="gap-1">
                      <View className="h-1.5 bg-border rounded-full overflow-hidden">
                        <View
                          style={{ width: strength.width, backgroundColor: strength.color }}
                          className="h-full rounded-full"
                        />
                      </View>
                      <Text style={{ color: strength.color }} className="text-xs font-medium">
                        {strength.level}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </form.Field>

            <form.Field
              name="confirmPassword"
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }: any) => {
                  const pwd = fieldApi.form.getFieldValue('password')
                  if (!value) return 'Please confirm your password'
                  if (value !== pwd) return 'Passwords do not match'
                  return undefined
                },
              }}
            >
              {(field) => (
                <View className="gap-1">
                  <Text className="text-sm font-medium text-muted-foreground">Confirm Password</Text>
                  <Input
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder="Re-enter your password"
                    secureTextEntry
                  />
                  {field.state.meta.errors?.[0] && (
                    <Text className="text-xs text-destructive">{field.state.meta.errors[0]}</Text>
                  )}
                </View>
              )}
            </form.Field>

            <Button onPress={form.handleSubmit} className="mt-4">
              Continue
            </Button>

            <View className="flex-row items-center justify-center gap-1 mt-2">
              <Text className="text-muted-foreground">Already have an account?</Text>
              <Pressable onPress={() => router.push('/(auth)/login' as any)}>
                <Text className="text-primary font-medium">Sign in</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 2: Terms & Conditions */}
        {currentStep === 1 && (
          <View className="px-6 py-4 gap-4 flex-1">
            <View className="items-center gap-2">
              <View className="h-12 w-12 rounded-full bg-primary/10 items-center justify-center">
                <FileText size={24} color="#34A2DF" />
              </View>
              <Text className="text-xl font-semibold text-foreground">Terms and Conditions</Text>
              <Text className="text-sm text-muted-foreground text-center">
                Please read and accept our terms to complete your registration
              </Text>
            </View>

            <View className="border border-border rounded-xl bg-card" style={{ height: 280 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                onScroll={(e) => {
                  const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
                  const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
                  if (isAtBottom) setHasScrolledToBottom(true)
                }}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={true}
              >
                <View style={{ gap: 16 }}>
                  <View>
                    <Text className="font-semibold text-foreground mb-2">1. Acceptance of Terms</Text>
                    <Text className="text-muted-foreground text-sm leading-relaxed">
                      By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-foreground mb-2">2. Use License</Text>
                    <Text className="text-muted-foreground text-sm leading-relaxed">
                      Permission is granted to temporarily download one copy of the materials on our service for personal, non-commercial transitory viewing only.
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-foreground mb-2">3. Privacy Policy</Text>
                    <Text className="text-muted-foreground text-sm leading-relaxed">
                      Your privacy is important to us. We collect and process your personal information in accordance with applicable data protection laws.
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-foreground mb-2">4. User Responsibilities</Text>
                    <Text className="text-muted-foreground text-sm leading-relaxed">
                      You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-foreground mb-2">5. Content Guidelines</Text>
                    <Text className="text-muted-foreground text-sm leading-relaxed">
                      Users must be 18 years or older to use this platform. You agree not to post content that violates our community guidelines or applicable laws.
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>

            {!hasScrolledToBottom && (
              <View className="items-center">
                <Text className="text-sm text-muted-foreground">Please scroll to the bottom to continue</Text>
              </View>
            )}

            <Pressable
              onPress={() => hasScrolledToBottom && setTermsAccepted(!termsAccepted)}
              className="flex-row items-start gap-3 p-4 rounded-xl border border-border bg-card"
            >
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => hasScrolledToBottom && setTermsAccepted(v)}
              />
              <Text className={`flex-1 text-sm leading-relaxed ${!hasScrolledToBottom ? 'text-muted-foreground' : 'text-foreground'}`}>
                I have read and agree to the Terms and Conditions, and I consent to the processing of my personal data.
              </Text>
            </Pressable>

            <View className="flex-row gap-3 mt-2">
              <Button variant="secondary" onPress={() => setCurrentStep(0)} className="flex-1">
                Back
              </Button>
              <Button
                onPress={handleFinalSubmit}
                disabled={!termsAccepted || !hasScrolledToBottom || isSubmitting}
                loading={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating Account...' : 'Complete Sign Up'}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
