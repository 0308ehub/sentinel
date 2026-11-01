"use client";

import { useMemo } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

export interface Account {
  name: string;
  email: string;
  imageUrl: string;
  signOut: () => Promise<void>;
}

function useClerkAccount(): Account | null {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  return useMemo(() => {
    if (!isLoaded || !user) return null;

    return {
      name: user.fullName ?? "",
      email: user.primaryEmailAddress?.emailAddress ?? "",
      imageUrl: user.imageUrl,
      signOut: () => signOut({ redirectUrl: "/" }),
    };
  }, [isLoaded, signOut, user]);
}

function useLocalAccount(): null {
  return null;
}

export const useAccount = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useClerkAccount
  : useLocalAccount;
