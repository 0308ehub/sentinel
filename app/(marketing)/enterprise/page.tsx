import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Enterprise — Sentinel' }

export default function EnterprisePage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Enterprise' }}
      title="Built for teams that need more"
      description="Advanced security, dedicated support, custom SLAs, and the flexibility to deploy Sentinel the way your organization requires."
      cards={[
        { title: 'SSO & SCIM', body: 'SAML 2.0 SSO and SCIM provisioning with Okta, Azure AD, Google Workspace, and any compatible identity provider.' },
        { title: 'Data residency', body: 'Choose US, EU, or APAC for your data residency. Data never crosses regional boundaries without explicit written consent.' },
        { title: 'Customer-managed keys', body: 'Bring your own encryption keys via AWS KMS or Google Cloud KMS. Full control over who can decrypt your data.' },
        { title: 'Dedicated support', body: 'A named customer success manager, a private Slack channel with the Sentinel team, and a 4-hour SLA on critical issues.' },
        { title: 'Custom SLAs', body: '99.9% uptime guarantee with financial remedies. Custom SLAs available for mission-critical deployments.' },
        { title: 'SOC 2 Type II', body: 'Audit reports, security questionnaires, and penetration test summaries available under NDA to qualified enterprise prospects.' },
      ]}
      ctaLabel="Talk to sales"
      ctaHref="/contact"
      ctaSecondaryLabel="Download security overview"
      ctaSecondaryHref="/security"
    />
  )
}
