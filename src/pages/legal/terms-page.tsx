import { Link } from 'react-router-dom'
import { env } from '@/lib/env'
import {
  LegalLayout,
  LegalPara,
  LegalBullets,
  LegalNumbered,
  LegalCallout,
  type LegalSection,
} from './legal-layout'

const UPDATED_AT = '13 October 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of these Terms',
    content: (
      <>
        <LegalPara>
          These Terms &amp; Conditions ("Terms") govern your access to and use of {env.appName}, a
          multi-branch sales, inventory and point-of-sale platform (the "Service"). By creating an
          account, accessing the Service, or clicking to accept these Terms, you agree to be bound by
          them on behalf of yourself and the business you represent.
        </LegalPara>
        <LegalCallout title="If you do not agree" tone="warning">
          If you do not accept these Terms, you must not register for or use the Service. If you use
          the Service on behalf of an organisation, you confirm you are authorised to bind that
          organisation to these Terms.
        </LegalCallout>
      </>
    ),
  },
  {
    id: 'accounts',
    title: '2. Accounts & eligibility',
    content: (
      <>
        <LegalPara>
          To use the Service you must be at least 18 years old and able to form a binding contract.
          Each business workspace is provisioned as a separate tenant, and access is granted to named
          user accounts with role-based permissions.
        </LegalPara>
        <LegalBullets
          items={[
            'You are responsible for the accuracy of the information you provide when registering.',
            'You must keep your login credentials confidential and secure, and must not share accounts between individuals.',
            'You are responsible for all activity that occurs under your account and for the actions of staff you invite.',
            'You must notify us promptly of any unauthorised access or suspected security incident involving your workspace.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'service',
    title: '3. The Service',
    content: (
      <>
        <LegalPara>
          {env.appName} provides tools for point of sale, stock and inventory control, purchasing,
          customer and credit management, expenses, reporting, staff and branch administration, and
          subscription management. Features available to you depend on your subscription plan and the
          permissions assigned to your account.
        </LegalPara>
        <LegalPara>
          The Service is provided on a hosted, software-as-a-service basis and includes an
          installable, offline-capable web experience. Certain documents — such as receipts, invoices
          and reports — are generated from the data you enter, and you remain responsible for
          reviewing them before relying on them for accounting, tax or legal purposes.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'subscriptions',
    title: '4. Plans, billing & renewals',
    content: (
      <>
        <LegalPara>
          Access to the Service is offered on paid subscription plans. Each plan defines limits such as
          the number of active branches, the number of active staff accounts, and the billing duration,
          together with a grace period that applies to overdue balances.
        </LegalPara>
        <LegalNumbered
          items={[
            'Subscriptions renew for the duration stated at the time of purchase unless cancelled or otherwise agreed.',
            'Invoices are issued in arrears or in advance as stated on the invoice and carry a due date.',
            'If an invoice becomes overdue beyond its due date and any applicable grace period, mutating actions in your workspace — including sales, purchasing and stock changes — may be suspended until the balance is settled.',
            'Read-only access and administrative recovery actions may remain available while an account is suspended so you can review and settle outstanding balances.',
            'All fees are exclusive of taxes unless stated otherwise, and you are responsible for any applicable taxes.',
          ]}
        />
        <LegalPara>
          Plan limits and pricing may be updated from time to time. Where a change materially reduces
          your entitlements, we will give reasonable notice before it takes effect.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable use',
    content: (
      <>
        <LegalPara>You agree not to misuse the Service. In particular, you must not:</LegalPara>
        <LegalBullets
          items={[
            'Reverse engineer, resell, sublicense or attempt to gain unauthorised access to the Service or its underlying infrastructure.',
            'Upload malicious code, attempt to disrupt the Service, or interfere with other tenants.',
            'Use the Service to store or transmit unlawful, infringing or fraudulent content.',
            'Misrepresent identity, impersonate another business, or bypass tenant, permission or billing controls.',
            'Use automated tools to scrape or extract data in a manner that impairs performance for other users.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'data',
    title: '6. Your data',
    content: (
      <>
        <LegalPara>
          You retain ownership of the business, product and transaction data you submit to the Service
          ("Customer Data"). We process Customer Data to provide, secure and support the Service, as
          described in our{' '}
          <Link to="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </LegalPara>
        <LegalPara>
          You are responsible for ensuring that you have a lawful basis to collect and process the
          personal information of your customers and staff that you enter into the Service, and for
          keeping that data accurate and up to date.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'ip',
    title: '7. Intellectual property',
    content: (
      <LegalPara>
        The Service, including its software, design, branding, documentation and all related
        intellectual property, is owned by us or our licensors and is protected by applicable laws.
        We grant you a limited, non-exclusive, non-transferable right to use the Service during your
        subscription, subject to these Terms. No other rights are granted, whether by implication or
        otherwise.
      </LegalPara>
    ),
  },
  {
    id: 'third-party',
    title: '8. Third-party services',
    content: (
      <LegalPara>
        The Service may integrate with or rely on third-party services, such as payment processors,
        messaging providers and infrastructure partners. Your use of those services may be subject to
        their own terms, and we are not responsible for the acts or omissions of third parties.
      </LegalPara>
    ),
  },
  {
    id: 'availability',
    title: '9. Availability & support',
    content: (
      <>
        <LegalPara>
          We aim to keep the Service available and performant, but we do not guarantee uninterrupted or
          error-free operation. Maintenance, upgrades, third-party outages and events beyond our
          reasonable control may affect availability.
        </LegalPara>
        <LegalPara>
          Because {env.appName} supports offline operation, some functionality may continue to work
          while disconnected; changes are synchronised when connectivity is restored, and conflicts are
          resolved according to the rules built into the Service.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: '10. Disclaimers',
    content: (
      <>
        <LegalPara>
          The Service is provided "as is" and "as available" without warranties of any kind, whether
          express or implied, including implied warranties of merchantability, fitness for a particular
          purpose and non-infringement, to the maximum extent permitted by law.
        </LegalPara>
        <LegalPara>
          We do not warrant that the Service will meet your specific business requirements or that any
          reports, calculations or documents generated by the Service will be free from error. You are
          responsible for reconciling results against your own records.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'liability',
    title: '11. Limitation of liability',
    content: (
      <LegalPara>
        To the maximum extent permitted by law, neither party will be liable for indirect, incidental,
        special, consequential or punitive damages, or for loss of profits, revenue, data or goodwill.
        Our total aggregate liability arising out of or relating to the Service is limited to the fees
        paid by you for the Service in the twelve (12) months preceding the event giving rise to the
        claim.
      </LegalPara>
    ),
  },
  {
    id: 'termination',
    title: '12. Suspension & termination',
    content: (
      <>
        <LegalPara>
          You may stop using the Service and cancel your subscription at any time. We may suspend or
          terminate access if you materially breach these Terms, fail to pay applicable fees, or use
          the Service in a way that creates risk or legal exposure for us or other tenants.
        </LegalPara>
        <LegalPara>
          On termination, your right to access the Service ends. You may export your data during the
          notice period, after which Customer Data may be deleted in accordance with our retention
          practices and the <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'changes',
    title: '13. Changes to these Terms',
    content: (
      <LegalPara>
        We may update these Terms from time to time to reflect changes to the Service or applicable
        law. When we make material changes we will update the "Last updated" date and, where
        appropriate, provide notice within the Service. Continued use after changes take effect
        constitutes acceptance of the revised Terms.
      </LegalPara>
    ),
  },
  {
    id: 'law',
    title: '14. Governing law',
    content: (
      <LegalPara>
        These Terms are governed by the laws of the jurisdiction in which the Service provider is
        established, without regard to conflict-of-law principles. The courts of that jurisdiction will
        have exclusive jurisdiction over any dispute arising out of or relating to these Terms, unless
        mandatory local law provides otherwise.
      </LegalPara>
    ),
  },
  {
    id: 'contact',
    title: '15. Contact',
    content: (
      <LegalPara>
        Questions about these Terms? Contact the {env.appName} team through your workspace support
        channel, or reach us from the contact options on our home page. We are happy to clarify how
        these Terms apply to your use of the Service.
      </LegalPara>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Terms of Service"
      title="Terms & Conditions"
      summary="The agreement between you and the operator of SalesMgt. These Terms explain what you can expect from the Service, what we expect from you, and how billing, data and liability are handled."
      updatedAt={UPDATED_AT}
      icon="terms"
      sections={SECTIONS}
    />
  )
}
