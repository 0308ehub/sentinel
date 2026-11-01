import { SignIn } from "@clerk/nextjs";
import { AuthFrame, KeylessAuth, authAppearance } from "@/components/auth/auth-frame";

export default function SignInPage() {
  return (
    <AuthFrame>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/ai"
          appearance={authAppearance}
        />
      ) : (
        <KeylessAuth mode="sign-in" />
      )}
    </AuthFrame>
  );
}
