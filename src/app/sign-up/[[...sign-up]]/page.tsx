import { SignUp } from "@clerk/nextjs";
import { AuthFrame, KeylessAuth, authAppearance } from "@/components/auth/auth-frame";
import { SIGN_UP_DESTINATION } from "@/lib/auth/destinations";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Sign up", "Create a Kismet account.");

export default function SignUpPage() {
  return (
    <AuthFrame>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl={SIGN_UP_DESTINATION}
          fallbackRedirectUrl={SIGN_UP_DESTINATION}
          appearance={authAppearance}
        />
      ) : (
        <KeylessAuth mode="sign-up" />
      )}
    </AuthFrame>
  );
}
