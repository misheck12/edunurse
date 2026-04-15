import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "../src/components/SEO";

const TermsAndConditions: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <SEO
        title="Terms and Conditions"
        description="EduNurse Pro Terms and Conditions of Service"
        canonicalPath="/terms"
      />
      <div className="mx-auto max-w-3xl">
        <Link
          to="/signup"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-bold text-slate-900">Terms and Conditions</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated: 15 April 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Introduction</h2>
              <p className="mt-2">
                These Terms and Conditions ("Terms") govern your access to and use of the EduNurse Pro
                platform ("Platform"), operated by Livingi Labs ("Company", "we", "our", "us"),
                registered in Zambia. By creating an account or using the Platform, you agree to be
                bound by these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Definitions</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>"Platform"</strong> means the EduNurse Pro web application, APIs, and related services.</li>
                <li><strong>"User"</strong> means any individual who creates an account on the Platform, including students, educators, and administrators.</li>
                <li><strong>"Content"</strong> means lesson plans, assessments, study materials, and any other output generated through the Platform.</li>
                <li><strong>"Subscription"</strong> means a paid plan providing access to premium features.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">3. Eligibility</h2>
              <p className="mt-2">
                You must be at least 18 years old and enrolled in or employed by a recognised nursing
                or midwifery educational institution in Zambia (or elsewhere) to use this Platform.
                By registering, you confirm that the information you provide — including your NRC /
                passport number, student number, and school — is accurate and up to date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">4. Account Responsibilities</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You must not share your account or allow others to access the Platform through your account.</li>
                <li>You must notify us immediately if you suspect any unauthorised use of your account.</li>
                <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">5. Use of AI-Generated Content</h2>
              <p className="mt-2">
                The Platform uses artificial intelligence to generate educational content including
                lesson plans, assessments, clinical case scenarios, and study materials. You
                acknowledge and agree that:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>AI-generated content is intended as a <strong>professional aid</strong>, not a replacement for clinical judgement or professional expertise.</li>
                <li>All generated content should be reviewed by a qualified educator or practitioner before use in teaching or clinical settings.</li>
                <li>The Company does not guarantee the clinical accuracy, completeness, or suitability of AI-generated content for any specific purpose.</li>
                <li>You assume full responsibility for how you use, adapt, and distribute generated content.</li>
                <li>Content aligned to the NMCZ (Nursing and Midwifery Council of Zambia) curriculum is based on publicly available syllabi and may not reflect the most recent updates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">6. Payments and Subscriptions</h2>
              <p className="mt-2">
                Payments are processed via mobile money (MTN, Airtel, Zamtel) through our payment
                partner, Lenco. By subscribing, you agree that:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>All prices are listed in Zambian Kwacha (ZMW) and are inclusive of applicable fees.</li>
                <li>Monthly subscriptions renew automatically unless cancelled before the renewal date.</li>
                <li>Pay-as-you-go credits are non-refundable once used.</li>
                <li>We reserve the right to change pricing with 30 days' notice.</li>
                <li>Refund requests for subscription payments must be made within 7 days of the charge and will be assessed on a case-by-case basis.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">7. Referral Programme</h2>
              <p className="mt-2">
                Users may earn commissions through our referral programme. Referral earnings are
                subject to the following conditions:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Commission is earned only on successful, non-refunded payments made by referred users.</li>
                <li>Self-referrals or fraudulent referral activity will result in forfeiture of earnings and possible account suspension.</li>
                <li>We reserve the right to modify or discontinue the referral programme at any time.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">8. Intellectual Property</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The Platform, its design, code, and branding are the intellectual property of Livingi Labs.</li>
                <li>Content you generate through the Platform is yours to use for educational purposes.</li>
                <li>You grant us a limited, non-exclusive licence to use anonymised, aggregated usage data to improve the Platform.</li>
                <li>You must not reverse-engineer, copy, or redistribute any part of the Platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">9. Prohibited Conduct</h2>
              <p className="mt-2">You must not:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Use the Platform for any unlawful purpose.</li>
                <li>Attempt to gain unauthorised access to other accounts or system resources.</li>
                <li>Use the Platform to generate content that is harmful, discriminatory, or misleading.</li>
                <li>Resell or commercially redistribute generated content without authorisation.</li>
                <li>Abuse the API or automated systems to circumvent usage limits.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">10. Limitation of Liability</h2>
              <p className="mt-2">
                To the maximum extent permitted by law, the Company shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, including but not
                limited to loss of data, loss of revenue, or clinical outcomes arising from the use
                of AI-generated content.
              </p>
              <p className="mt-2">
                The Platform is provided "as is" without warranties of any kind, express or implied.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">11. Termination</h2>
              <p className="mt-2">
                We may suspend or terminate your access to the Platform at any time for violation of
                these Terms, with or without notice. Upon termination, your right to use the Platform
                ceases immediately. You may export your generated content before account closure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">12. Changes to These Terms</h2>
              <p className="mt-2">
                We may update these Terms from time to time. Material changes will be communicated
                via email or an in-app notification. Continued use of the Platform after changes
                constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">13. Governing Law</h2>
              <p className="mt-2">
                These Terms are governed by the laws of the Republic of Zambia. Any disputes shall
                be resolved through the courts of Zambia.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">14. Contact Us</h2>
              <p className="mt-2">
                If you have questions about these Terms, contact us at:
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

export default TermsAndConditions;
