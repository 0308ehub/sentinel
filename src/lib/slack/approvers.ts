import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import type { EligibleApprover } from "@/lib/slack/approvers-core";

function warning(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Could not load Kismet Slack approvers: ${message}`);
}

export async function slackUserEmail(slackUserId: string, token: string): Promise<string | null> {
  try {
    const url = new URL("https://slack.com/api/users.info");
    url.searchParams.set("user", slackUserId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await response.json() as {
      ok?: boolean;
      user?: { profile?: { email?: unknown } };
    };
    const email = body.user?.profile?.email;
    return response.ok && body.ok && typeof email === "string" && email.trim() ? email : null;
  } catch {
    return null;
  }
}

export async function eligibleApprovers(accountId: string): Promise<EligibleApprover[]> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return [];

  try {
    const clerk = await clerkClient();
    let userIds: string[];
    if (accountId.startsWith("org_")) {
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: accountId,
        limit: 100,
      });
      userIds = memberships.data
        .filter((membership) => membership.role === "org:admin")
        .map((membership) => membership.publicUserData?.userId)
        .filter((userId): userId is string => Boolean(userId));
    } else {
      userIds = [accountId];
    }

    return Promise.all(userIds.map(async (userId) => {
      const user = await clerk.users.getUser(userId);
      const emails = user.emailAddresses
        .filter((email) => email.verification?.status === "verified")
        .map((email) => email.emailAddress);
      return { userId, emails };
    }));
  } catch (error) {
    warning(error);
    return [];
  }
}
