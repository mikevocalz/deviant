import { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useForm } from "@tanstack/react-form";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Input } from "@/components/ui";
import { FormInput } from "@/components/form";
import { useSignupStore } from "@/lib/stores/signup-store";
import { users } from "@/lib/api-client";
import { CheckCircle2, XCircle } from "lucide-react-native";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1)
    return { level: "Weak", color: "#ef4444", width: "25%" as const };
  if (score <= 2)
    return { level: "Fair", color: "#f97316", width: "50%" as const };
  if (score <= 3)
    return { level: "Good", color: "#eab308", width: "75%" as const };
  return { level: "Strong", color: "#34A2DF", width: "100%" as const };
}

export function SignUpStep1() {
  const { formData, updateFormData, setActiveStep } = useSignupStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState(formData?.password || "");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkTimeoutId, setCheckTimeoutId] = useState<NodeJS.Timeout | null>(
    null,
  );

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus("checking");
    try {
      const result = await users.checkUsername(username);
      if (result.available) {
        setUsernameStatus("available");
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus("taken");
        setUsernameSuggestions(result.suggestions);
      }
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  const handleUsernameChange = useCallback(
    (value: string, onChange: (v: string) => void) => {
      if (checkTimeoutId) clearTimeout(checkTimeoutId);

      // Normalize: lowercase, remove spaces
      const normalized = value.toLowerCase().replace(/\s/g, "");
      if (normalized !== value) {
        onChange(normalized);
      }

      if (normalized.length >= 3 && /^[a-z0-9_]+$/.test(normalized)) {
        const timeoutId = setTimeout(() => {
          checkUsernameAvailability(normalized);
        }, 500);
        setCheckTimeoutId(timeoutId);
      } else {
        setUsernameStatus("idle");
        setUsernameSuggestions([]);
      }
    },
    [checkTimeoutId, checkUsernameAvailability],
  );

  const form = useForm({
    defaultValues: {
      firstName: formData?.firstName || "",
      lastName: formData?.lastName || "",
      email: formData?.email || "",
      username: formData?.username || "",
      phone: formData?.phone || "",
      dateOfBirth: formData?.dateOfBirth || "",
      password: formData?.password || "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      updateFormData({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        username: value.username,
        phone: value.phone,
        dateOfBirth: value.dateOfBirth,
        password: value.password,
      });
      setActiveStep(1);
    },
  });

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
                if (!value) return "First name is required";
                if (value.length < 2) return "Must be at least 2 characters";
                return undefined;
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
                if (!value) return "Last name is required";
                if (value.length < 2) return "Must be at least 2 characters";
                return undefined;
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
            if (!value) return "Email is required";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
              return "Please enter a valid email";
            return undefined;
          },
        }}
      />

      <form.Field
        name="username"
        validators={{
          onChange: ({ value }: any) => {
            if (!value) return "Username is required";
            if (value.length < 3)
              return "Username must be at least 3 characters";
            if (value.length > 20)
              return "Username must be 20 characters or less";
            if (!/^[a-z0-9_]+$/.test(value))
              return "Only lowercase letters, numbers, and underscores";
            if (usernameStatus === "taken") return "Username is already taken";
            return undefined;
          },
        }}
      >
        {(field) => (
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">
              Username
            </Text>
            <View className="relative">
              <Input
                value={field.state.value}
                onChangeText={(text) => {
                  field.handleChange(text);
                  handleUsernameChange(text, field.handleChange);
                }}
                onBlur={field.handleBlur}
                placeholder="johndoe"
                autoCapitalize="none"
              />
              <View className="absolute right-3 top-3">
                {usernameStatus === "checking" && (
                  <ActivityIndicator size="small" color="#34A2DF" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 size={20} color="#22c55e" />
                )}
                {usernameStatus === "taken" && (
                  <XCircle size={20} color="#ef4444" />
                )}
              </View>
            </View>
            {usernameStatus === "available" && (
              <Text className="text-xs text-green-500">
                Username is available!
              </Text>
            )}
            {usernameStatus === "taken" && (
              <View className="gap-1">
                <Text className="text-xs text-destructive">
                  Username is already taken
                </Text>
                {usernameSuggestions.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-1">
                    <Text className="text-xs text-muted">Try:</Text>
                    {usernameSuggestions.map((suggestion) => (
                      <Pressable
                        key={suggestion}
                        onPress={() => {
                          field.handleChange(suggestion);
                          handleUsernameChange(suggestion, field.handleChange);
                        }}
                        className="px-2 py-1 bg-primary/10 rounded"
                      >
                        <Text className="text-xs text-primary">
                          {suggestion}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            {field.state.meta.errors?.[0] && usernameStatus !== "taken" && (
              <Text className="text-xs text-destructive">
                {field.state.meta.errors[0]}
              </Text>
            )}
          </View>
        )}
      </form.Field>

      <FormInput
        form={form}
        name="phone"
        label="Phone Number"
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
        validators={{
          onChange: ({ value }: any) => {
            if (!value) return "Phone number is required";
            return undefined;
          },
        }}
      />

      <form.Field name="dateOfBirth">
        {(field) => {
          const dateValue = field.state.value
            ? new Date(field.state.value)
            : new Date(2000, 0, 1);

          return (
            <View className="gap-1">
              <Text className="text-sm font-medium text-foreground">
                Date of Birth
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="h-12 px-4 rounded-lg border border-border bg-card justify-center"
              >
                <Text
                  className={
                    field.state.value ? "text-foreground" : "text-muted"
                  }
                >
                  {field.state.value || "Select date"}
                </Text>
              </Pressable>
              {showDatePicker && (
                <View>
                  <DateTimePicker
                    value={dateValue}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={(event: any, selectedDate: Date | undefined) => {
                      // On Android, close immediately. On iOS, keep open until user dismisses
                      if (Platform.OS === "android") {
                        setShowDatePicker(false);
                      }
                      if (selectedDate) {
                        // Use local date to avoid timezone issues
                        const year = selectedDate.getFullYear();
                        const month = String(
                          selectedDate.getMonth() + 1,
                        ).padStart(2, "0");
                        const day = String(selectedDate.getDate()).padStart(
                          2,
                          "0",
                        );
                        field.handleChange(`${year}-${month}-${day}`);
                      }
                    }}
                  />
                  {Platform.OS === "ios" && (
                    <Button
                      onPress={() => setShowDatePicker(false)}
                      className="mt-2"
                    >
                      Done
                    </Button>
                  )}
                </View>
              )}
            </View>
          );
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">
              Password
            </Text>
            <Input
              value={field.state.value}
              onChangeText={(text) => {
                field.handleChange(text);
                setPassword(text);
              }}
              onBlur={field.handleBlur}
              placeholder="Create a strong password"
              secureTextEntry
            />
            {password.length > 0 && (
              <View className="gap-1">
                <View className="h-1.5 bg-border rounded-full overflow-hidden">
                  <View
                    style={{
                      width: strength.width,
                      backgroundColor: strength.color,
                    }}
                    className="h-full rounded-full"
                  />
                </View>
                <Text
                  style={{ color: strength.color }}
                  className="text-xs font-medium"
                >
                  {strength.level}
                </Text>
              </View>
            )}
            {field.state.meta.errors?.[0] && (
              <Text className="text-xs text-destructive">
                {field.state.meta.errors[0]}
              </Text>
            )}
          </View>
        )}
      </form.Field>

      <form.Field
        name="confirmPassword"
        validators={{
          onChangeListenTo: ["password"],
          onChange: ({ value, fieldApi }: any) => {
            const pwd = fieldApi.form.getFieldValue("password");
            if (!value) return "Please confirm your password";
            if (value !== pwd) return "Passwords do not match";
            return undefined;
          },
        }}
      >
        {(field) => (
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">
              Confirm Password
            </Text>
            <Input
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder="Re-enter your password"
              secureTextEntry
            />
            {field.state.meta.errors?.[0] && (
              <Text className="text-xs text-destructive">
                {field.state.meta.errors[0]}
              </Text>
            )}
          </View>
        )}
      </form.Field>

      <Button onPress={form.handleSubmit} className="my-12">
        Continue
      </Button>
    </View>
  );
}
