import { SignUp } from "@clerk/nextjs";
import { AuthFrame, KeylessAuth, authAppearance } from "@/components/auth/auth-frame";

export default function SignUpPage() {
  return (
    <AuthFrame>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/onboarding/you"
          appearance={authAppearance}
        />
      ) : (
        <KeylessAuth mode="sign-up" />
      )}
    </AuthFrame>
  );
}
