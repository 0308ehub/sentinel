import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Security — Sentinel' }

export default function SecurityPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Security' }}
      title="Enterprise-grade security, by default"
      description="Sentinel is built on a zero-trust architecture. Your data never trains our models, and every access decision is logged, auditable, and revocable."
      cards={[
        { title: 'SOC 2 Type II', body: 'Sentinel is SOC 2 Type II certified. Audit reports are available to enterprise customers under NDA.' },
        { title: 'Data residency', body: 'Choose where your data is stored — US, EU, or APAC. Data never crosses regional boundaries without explicit consent.' },
        { title: 'No model training', body: 'Your data is never used to train Sentinel\'s models. Signals stay in your workspace and are never shared across tenants.' },
        { title: 'SSO & SCIM', body: 'SAML 2.0 SSO and SCIM provisioning work with Okta, Azure AD, Google Workspace, and any SAML-compatible IdP.' },
        { title: 'Encryption', body: 'All data is encrypted at rest with AES-256 and in transit with TLS 1.3. Encryption keys are customer-managed on Enterprise plans.' },
        { title: 'Access controls', body: 'Role-based access controls, workspace isolation, and per-integration permission scopes give you precise control over who sees what.' },
      ]}
      ctaLabel="Talk to our security team"
      ctaHref="/contact"
      ctaSecondaryLabel="Download security overview"
      ctaSecondaryHref="/download"
    />
  )
}
