import { Link } from 'react-router-dom'
import { env } from '@/lib/env'
import {
  LegalLayout,
  LegalPara,
  LegalSubHeading,
  LegalBullets,
  LegalNumbered,
  LegalCallout,
  type LegalSection,
} from './legal-layout'

const UPDATED_AT = '13 October 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Scope of this policy',
    content: (
      <>
        <LegalPara>
          This Privacy Policy explains how {env.appName} ("we", "us", "our") collects, uses, shares
          and protects personal information when you use our multi-branch sales, inventory and
          point-of-sale platform, including our website, web application and installable
          offline-capable app (together, the "Service").
        </LegalPara>
        <LegalPara>
          In most cases, the business that owns a workspace is the controller of the data entered into
          it, and we act as a processor on that business's behalf. Where we determine the purposes of
          processing — for example, account administration, billing and security — we act as a
          controller.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'collect',
    title: '2. Information we collect',
    content: (
      <>
        <LegalSubHeading>Information you provide</LegalSubHeading>
        <LegalBullets
          items={[
            'Account details such as your name, email address, phone number, role and password credentials.',
            'Business details such as business name, branches, tax identifiers and contact information.',
            'Operational data you or your staff create in the Service — products, stock movements, sales, purchases, customers, suppliers, expenses, shifts and reports.',
            'Communications you send us, including support requests and feedback.',
          ]}
        />
        <LegalSubHeading>Information collected automatically</LegalSubHeading>
        <LegalBullets
          items={[
            'Device and connection data such as IP address, browser type, operating system and approximate location derived from IP.',
            'Usage data such as pages viewed, features used, and timestamps of actions within the Service.',
            'Diagnostic and log data used to secure the Service and troubleshoot issues.',
          ]}
        />
        <LegalSubHeading>Payment information</LegalSubHeading>
        <LegalPara>
          Subscription payments are processed by third-party payment providers. We do not store full
          payment card numbers on our servers; we receive limited billing information such as the last
          four digits, card brand and transaction status.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'use',
    title: '3. How we use information',
    content: (
      <>
        <LegalPara>We use personal information to:</LegalPara>
        <LegalNumbered
          items={[
            'Provide, operate and maintain the Service, including authenticating users and enforcing permissions.',
            'Process subscriptions, issue invoices and manage billing and collection.',
            'Secure the Service, detect and prevent fraud, abuse and unauthorised access.',
            'Provide customer support and respond to your requests.',
            'Send service-related communications such as invoices, security notices and product updates.',
            'Improve and develop the Service through aggregated, de-identified analytics.',
            'Comply with legal, tax and regulatory obligations.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'bases',
    title: '4. Legal bases for processing',
    content: (
      <>
        <LegalPara>
          Where required by law, we rely on the following legal bases to process personal information:
        </LegalPara>
        <LegalBullets
          items={[
            'Performance of a contract — to deliver the Service you have subscribed to.',
            'Legitimate interests — to secure, support and improve the Service, balanced against your rights.',
            'Consent — where you have expressly agreed, for example to certain optional communications.',
            'Legal obligation — to retain records and comply with applicable law.',
          ]}
        />
        <LegalPara>
          You may withdraw consent at any time, without affecting the lawfulness of processing carried
          out before withdrawal.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'sharing',
    title: '5. How we share information',
    content: (
      <>
        <LegalPara>
          We do not sell personal information. We share it only as needed to operate the Service:
        </LegalPara>
        <LegalBullets
          items={[
            'Within your workspace — with other users of the same business, subject to their role and permissions.',
            'With service providers and sub-processors such as hosting, payment, messaging and analytics partners, under contractual confidentiality and data-protection obligations.',
            'With your organisation — the business that owns the workspace can access and administer the data within it.',
            'For legal reasons — when required by law, regulation or valid legal process, or to protect the rights, safety and security of our users and the public.',
            'In a business transfer — if we are involved in a merger, acquisition or sale of assets, subject to this policy.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'retention',
    title: '6. Data retention',
    content: (
      <LegalBullets
        items={[
          'We retain personal information for as long as needed to provide the Service and for the period your workspace remains active.',
          'After account closure or termination, we retain data for a limited period so you can export it, and thereafter delete or anonymise it unless a longer retention period is required by law.',
            'Billing and tax records may be retained for the period required by applicable financial regulations.',
            'Backups are retained on a rolling basis and securely overwritten or deleted according to our retention schedule.',
        ]}
      />
    ),
  },
  {
    id: 'security',
    title: '7. Security',
    content: (
      <>
        <LegalPara>
          We use administrative, technical and organisational measures designed to protect personal
          information against unauthorised access, alteration, disclosure or destruction. These include
          encryption in transit, access controls, tenant isolation, role-based permissions, and audit
          logging of sensitive actions.
        </LegalPara>
        <LegalCallout title="No system is completely secure">
          No method of transmission or storage is completely secure. While we work hard to protect your
          information, we cannot guarantee absolute security. Please choose a strong password and keep
          your credentials confidential.
        </LegalCallout>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '8. Cookies & local storage',
    content: (
      <>
        <LegalPara>
          We use cookies and similar technologies (including browser local storage and a service
          worker cache) to keep you signed in, remember preferences, support offline operation, and
          understand how the Service is used.
        </LegalPara>
        <LegalBullets
          items={[
            'Strictly necessary cookies are required for authentication, security and core functionality.',
            'Preference storage remembers settings such as theme and workspace selection.',
            'Offline caches store an application shell and pending records so the Service can operate without connectivity.',
            'You can control cookies through your browser settings; disabling essential storage may prevent parts of the Service from working.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'rights',
    title: '9. Your rights & choices',
    content: (
      <>
        <LegalPara>
          Depending on where you live, you may have the right to access, correct, delete, restrict or
          object to the processing of your personal information, and to receive it in a portable
          format. This includes rights under the Nigeria Data Protection Act / NDPR, the EU/UK GDPR and
          similar laws.
        </LegalPara>
        <LegalPara>
          To exercise these rights, contact the business that owns your workspace or reach out to us
          using the details below. We will respond within the time required by applicable law. If you
          are unsatisfied, you may lodge a complaint with your local data-protection authority.
        </LegalPara>
      </>
    ),
  },
  {
    id: 'transfers',
    title: '10. International transfers',
    content: (
      <LegalPara>
        We may process and store information in countries other than your own. Where we transfer
        personal information across borders, we take steps to ensure an appropriate level of protection,
        such as relying on recognised safeguards and contractual commitments with our service
        providers.
      </LegalPara>
    ),
  },
  {
    id: 'children',
    title: "11. Children's privacy",
    content: (
      <LegalPara>
        The Service is intended for businesses and professional use and is not directed to children.
        We do not knowingly collect personal information from children. If you believe a child has
        provided information to us, please contact us so we can take appropriate action.
      </LegalPara>
    ),
  },
  {
    id: 'changes',
    title: '12. Changes to this policy',
    content: (
      <LegalPara>
        We may update this Privacy Policy from time to time to reflect changes to the Service, our
        practices or the law. When we make material changes, we will update the "Last updated" date
        and provide notice within the Service where appropriate. Continued use of the Service after an
        update constitutes acceptance of the revised policy.
      </LegalPara>
    ),
  },
  {
    id: 'contact',
    title: '13. Contact us',
    content: (
      <>
        <LegalPara>
          For privacy questions, requests or complaints, contact the {env.appName} team through your
          workspace support channel or the contact options on our home page. We take data-protection
          enquiries seriously and will work with you to resolve them promptly.
        </LegalPara>
        <LegalCallout title="See also">
          For the terms that govern your use of the Service, read our{' '}
          <Link to="/terms" className="font-semibold text-primary hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </LegalCallout>
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="How SalesMgt collects, uses and protects personal information across the platform, including your rights and the choices available to you."
      updatedAt={UPDATED_AT}
      icon="privacy"
      sections={SECTIONS}
    />
  )
}
