import { useState, useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useForm } from '@tanstack/react-form'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Button, Input } from '@/components/ui'
import { FormInput } from '@/components/form'
import { useSignupStore } from '@/lib/stores/signup-store'

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

export function SignUpStep1() {
  const { formData, updateFormData, setActiveStep } = useSignupStore()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [password, setPassword] = useState(formData?.password || '')
  
  const strength = useMemo(() => getPasswordStrength(password), [password])

  const form = useForm({
    defaultValues: {
      firstName: formData?.firstName || '',
      lastName: formData?.lastName || '',
      email: formData?.email || '',
      phone: formData?.phone || '',
      dateOfBirth: formData?.dateOfBirth || '',
      password: formData?.password || '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      updateFormData({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone,
        dateOfBirth: value.dateOfBirth,
        password: value.password,
      })
      setActiveStep(1)
    },
  })

  return (
    <View className="gap-4 pb-20">
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

      <FormInput
        form={form}
        name="phone"
        label="Phone Number"
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
        validators={{
          onChange: ({ value }: any) => {
            if (!value) return 'Phone number is required'
            return undefined
          },
        }}
      />

      <form.Field name="dateOfBirth">
        {(field) => {
          const dateValue = field.state.value ? new Date(field.state.value) : new Date(2000, 0, 1)
          
          return (
            <View className="gap-1">
              <Text className="text-sm font-medium text-foreground">Date of Birth</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="h-12 px-4 rounded-lg border border-border bg-card justify-center"
              >
                <Text className={field.state.value ? 'text-foreground' : 'text-muted'}>
                  {field.state.value || 'Select date'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dateValue}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_: any, selectedDate: Date | undefined) => {
                    setShowDatePicker(false)
                    if (selectedDate) {
                      field.handleChange(selectedDate.toISOString().split('T')[0])
                    }
                  }}
                />
              )}
            </View>
          )
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Password</Text>
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
            {field.state.meta.errors?.[0] && (
              <Text className="text-xs text-destructive">{field.state.meta.errors[0]}</Text>
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
            <Text className="text-sm font-medium text-foreground">Confirm Password</Text>
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

      <Button onPress={form.handleSubmit} className="my-12">
        Continue
      </Button>
    </View>
  )
}
