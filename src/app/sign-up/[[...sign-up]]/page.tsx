import { SignUp } from "@clerk/nextjs";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Sign up", "Create a Kismet account.");
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
