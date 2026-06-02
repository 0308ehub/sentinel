import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Download — Sentinel' }

export default function DownloadPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Resources' }}
      title="Get Sentinel everywhere"
      description="The Sentinel desktop app, mobile apps, and browser extension — available for all major platforms. Sign in with your existing account."
      cards={[
        { title: 'macOS', body: 'Native macOS app with menu bar integration, keyboard shortcuts, and offline sync. Requires macOS 13 Ventura or later.' },
        { title: 'Windows', body: 'Full-featured Windows app with system tray integration. Requires Windows 10 or later.' },
        { title: 'iOS', body: 'iPhone and iPad app with full insight feed, action approvals, and push notifications. Requires iOS 16 or later. Currently in closed beta.' },
        { title: 'Android', body: 'Android app with Material You design and home screen widgets. Requires Android 12 or later. Currently in closed beta.' },
        { title: 'Chrome extension', body: 'Surface Sentinel insights inline while browsing Linear, Jira, or GitHub. One-click issue creation from any tab.' },
        { title: 'Security overview', body: 'Read our security whitepaper before installing on managed devices. Available for enterprise customers under NDA.' },
      ]}
      ctaLabel="Sign in to download"
      ctaHref="/sign-in"
      ctaSecondaryLabel="Request enterprise package"
      ctaSecondaryHref="/contact"
    />
  )
}
