import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ProgressSteps, ProgressStep } from "react-native-progress-steps";
import { SignUpStep1, SignUpStep2, SignUpStep3 } from "@/components/signup";
import { useSignupStore } from "@/lib/stores/signup-store";

export default function SignupScreen() {
  const { activeStep } = useSignupStore();

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: "#000" }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={120}
      enabled={true}
    >
      <View className="items-center gap-4 pt-10 px-6">
        <View className="items-center gap-1">
          <Text className="text-3xl font-bold text-foreground">
            Create your account
          </Text>
          <Text className="text-muted-foreground">
            Complete the steps below to get started
          </Text>
        </View>
      </View>

      <ProgressSteps
        activeStep={activeStep}
        activeStepIconBorderColor="#34A2DF"
        completedProgressBarColor="#34A2DF"
        completedStepIconColor="#34A2DF"
        activeStepIconColor="#34A2DF"
        activeLabelColor="#34A2DF"
        labelColor="#a3a3a3"
        completedLabelColor="#34A2DF"
        disabledStepIconColor="#71717a"
        progressBarColor="#3f3f46"
      >
        <ProgressStep label="User Info" removeBtnRow>
          <SignUpStep1 />
        </ProgressStep>

        <ProgressStep label="Verification" removeBtnRow>
          <SignUpStep2 />
        </ProgressStep>

        <ProgressStep label="Terms" removeBtnRow>
          <SignUpStep3 />
        </ProgressStep>
      </ProgressSteps>
    </KeyboardAwareScrollView>
  );
}
