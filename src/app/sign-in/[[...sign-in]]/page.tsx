import { SignIn } from "@clerk/nextjs";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Sign in", "Sign in to Kismet.");
import { AuthFrame, KeylessAuth, authAppearance } from "@/components/auth/auth-frame";

export default function SignInPage() {
  return (
    <AuthFrame>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/enter"
          fallbackRedirectUrl="/enter"
          appearance={authAppearance}
        />
      ) : (
        <KeylessAuth mode="sign-in" />
      )}
    </AuthFrame>
  );
}
