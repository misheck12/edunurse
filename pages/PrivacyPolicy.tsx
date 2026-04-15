import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "../src/components/SEO";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <SEO
        title="Privacy Policy"
        description="EduNurse Pro Privacy Policy — how we collect, use, and protect your data"
        canonicalPath="/privacy"
      />
      <div className="mx-auto max-w-3xl">
        <Link
          to="/signup"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated: 15 April 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Introduction</h2>
              <p className="mt-2">
                Livingi Labs ("Company", "we", "our", "us") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, store, and share your personal
                information when you use the EduNurse Pro platform ("Platform"). This policy applies
                to all users, including students, educators, and administrators.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Information We Collect</h2>

              <h3 className="mt-3 text-sm font-semibold text-slate-800">2.1 Information You Provide</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li><strong>Account information:</strong> full name, email address, phone number, NRC / passport number, school, student number.</li>
                <li><strong>Profile information:</strong> programme, year of study, preferences.</li>
                <li><strong>Payment information:</strong> mobile money phone number and transaction references (we do not store PINs or passwords for payment services).</li>
                <li><strong>Content:</strong> lesson plans, assessments, and other materials you create using the Platform.</li>
                <li><strong>Communications:</strong> messages you send to us via support channels.</li>
              </ul>

              <h3 className="mt-3 text-sm font-semibold text-slate-800">2.2 Information We Collect Automatically</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li><strong>Usage data:</strong> pages visited, features used, generation and export counts, timestamps.</li>
                <li><strong>Device information:</strong> browser type, operating system, screen resolution.</li>
                <li><strong>Network data:</strong> IP address, approximate location (country/city level).</li>
                <li><strong>Cookies:</strong> we use essential cookies for authentication and session management only.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">3. How We Use Your Information</h2>
              <p className="mt-2">We use your information to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Provide, operate, and maintain the Platform and its features.</li>
                <li>Process payments and manage your subscription.</li>
                <li>Personalise content generation based on your curriculum, programme, and preferences.</li>
                <li>Send transactional communications (payment confirmations, account alerts, export notifications).</li>
                <li>Send marketing emails about new features, tips, and promotions (you can opt out at any time).</li>
                <li>Improve and develop new features using aggregated, anonymised usage analytics.</li>
                <li>Detect, investigate, and prevent fraud or unauthorised access.</li>
                <li>Comply with legal obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">4. Legal Basis for Processing</h2>
              <p className="mt-2">We process your data based on:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Contractual necessity:</strong> to provide the services you have signed up for.</li>
                <li><strong>Consent:</strong> for marketing communications and optional data sharing.</li>
                <li><strong>Legitimate interest:</strong> for platform improvement, security, and fraud prevention.</li>
                <li><strong>Legal obligation:</strong> to comply with applicable Zambian law.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">5. Data Sharing</h2>
              <p className="mt-2">We do <strong>not sell</strong> your personal data. We may share information with:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Payment processors:</strong> Lenco, for mobile money transaction processing.</li>
                <li><strong>AI providers:</strong> anonymised prompts sent to AI model providers (OpenAI, Google) for content generation. No personally identifiable information is included in AI prompts.</li>
                <li><strong>Communication services:</strong> email (Microsoft 365), SMS (Africa's Talking), and WhatsApp (Meta) for transactional and marketing messages.</li>
                <li><strong>Hosting providers:</strong> cloud infrastructure providers that host the Platform.</li>
                <li><strong>Law enforcement:</strong> when required by a valid legal order or to protect our rights.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">6. Data Storage and Security</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Your data is stored in secured PostgreSQL databases with encryption at rest and in transit.</li>
                <li>Passwords are hashed using industry-standard algorithms (bcrypt) and are never stored in plain text.</li>
                <li>Access to production systems is restricted to authorised personnel only.</li>
                <li>We implement rate limiting, CORS protection, and HMAC-based authentication tokens.</li>
                <li>While we take reasonable measures to protect your data, no system is 100% secure. We cannot guarantee absolute security.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">7. Data Retention</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Account data:</strong> retained for as long as your account is active, plus 12 months after deletion.</li>
                <li><strong>Generated content:</strong> retained until you delete it or close your account.</li>
                <li><strong>Transaction records:</strong> retained for 7 years for financial and tax compliance.</li>
                <li><strong>Usage logs:</strong> retained for 90 days, then aggregated and anonymised.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">8. Your Rights</h2>
              <p className="mt-2">You have the right to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Access</strong> your personal data held by us.</li>
                <li><strong>Correct</strong> inaccurate or incomplete data via your profile settings.</li>
                <li><strong>Delete</strong> your account and associated personal data (subject to legal retention requirements).</li>
                <li><strong>Export</strong> your generated content before account closure.</li>
                <li><strong>Withdraw consent</strong> for marketing communications at any time.</li>
                <li><strong>Object</strong> to processing based on legitimate interest.</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at <strong>support@edunurse.co.zm</strong>.
                We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">9. Children's Privacy</h2>
              <p className="mt-2">
                The Platform is not intended for individuals under the age of 18. We do not knowingly
                collect personal data from children. If we learn that a user is under 18, we will
                promptly delete their account and data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">10. International Data Transfers</h2>
              <p className="mt-2">
                Your data may be processed on servers outside of Zambia (including in the United
                States and European Union) through our cloud infrastructure and AI providers.
                Where such transfers occur, we ensure appropriate safeguards are in place.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">11. Changes to This Policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. Material changes will be
                communicated via email or an in-app notification. The "Last updated" date at the
                top will reflect the most recent revision.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">12. Contact Us</h2>
              <p className="mt-2">
                If you have questions about this Privacy Policy or how we handle your data, contact us at:
              </p>
              <ul className="mt-2 space-y-1 pl-5">
                <li><strong>Email:</strong> support@edunurse.co.zm</li>
                <li><strong>Company:</strong> Livingi Labs, Lusaka, Zambia</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
