import { SignIn } from "@clerk/nextjs";
import { AuthFrame, KeylessAuth, authAppearance } from "@/components/auth/auth-frame";
import { SIGN_IN_DESTINATION } from "@/lib/auth/destinations";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Sign in", "Sign in to Kismet.");

export default function SignInPage() {
  return (
    <AuthFrame>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl={SIGN_IN_DESTINATION}
          fallbackRedirectUrl={SIGN_IN_DESTINATION}
          appearance={authAppearance}
        />
      ) : (
        <KeylessAuth mode="sign-in" />
      )}
    </AuthFrame>
  );
}
