import { auth } from '@clerk/nextjs/server'
import { MarketingNavClient } from './MarketingNavClient'

export async function MarketingNav() {
  const { userId } = await auth()
  return <MarketingNavClient isLoggedIn={!!userId} />
}
