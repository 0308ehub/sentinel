import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Documentation — Sentinel' }

export default function DocumentationPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Resources' }}
      title="Everything you need to get started"
      description="Guides, API references, connector docs, and integration tutorials — all in one place. Most teams are up and running in under 30 minutes."
      cards={[
        { title: 'Quick start', body: 'Connect your first source, review your first insights, and create your first issue in under 30 minutes. Start here.' },
        { title: 'Connector setup', body: 'Step-by-step guides for every connector — Slack, Linear, Jira, Zendesk, Gong, Salesforce, and more.' },
        { title: 'Agent configuration', body: 'Customize how Sentinel\'s agents behave — thresholds, routing rules, automation triggers, and approval workflows.' },
        { title: 'REST API', body: 'Push custom signals, query insights, and trigger actions programmatically. Full OpenAPI spec and client libraries available.' },
        { title: 'Webhooks', body: 'Receive real-time events from Sentinel — new insights, created issues, agent actions, and status changes — in your own systems.' },
        { title: 'SSO & SCIM setup', body: 'Configure SAML 2.0 SSO and SCIM provisioning with Okta, Azure AD, Google Workspace, or any compatible identity provider.' },
      ]}
      ctaLabel="Open documentation"
      ctaHref="/sign-up"
    />
  )
}
