import { useEffect, useState } from 'react';
import Footer from './Footer/Footer';

const PrivacyPolicy = () => {
  // states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  // functions
  const handleScrollTop = () => {
    const ele = document.getElementById('privacy-policy');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // effects
  useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header id="privacy-policy" className="pt-20" />

      <div className="mb-24">
        <div className="flex flex-col items-center mb-10">
          <h1 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-chocoBrown">Privacy policy</h1>
        </div>

        <div className="sm:w-3/4 w-11/12 mx-auto font-commissioner sm:text-2xl text-xl flex flex-col gap-8">
          <p>
            <strong>Effective Date:</strong> [Insert Date]
          </p>

          <p>
            CapyTube ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy outlines how we
            collect, use, disclose, and safeguard your information when you visit our website or use our services.
            Please read this Privacy Policy carefully. By using CapyTube, you agree to the collection and use of
            information in accordance with this policy.
          </p>

          <div>
            <h2>
              1. <strong>Information We Collect</strong>
            </h2>
            <p>
              a. Personal Information
              <br />
              When you sign up for CapyTube, we may collect personally identifiable information such as your name, email
              address, and payment details.
            </p>
            <p>
              b. Non-Personal Information
              <br />
              We may collect non-personal information, such as your browser type, device, IP address, time zone, and how
              you interact with our services (e.g., pages viewed, clicks, and navigation patterns).
            </p>
            <p>
              c. Cookies and Tracking Technologies
              <br />
              We use cookies and other tracking technologies to enhance your experience on CapyTube. These tools allow
              us to collect data about how you use our services and help us to customize content, improve performance,
              and target advertisements.
            </p>
          </div>

          <div>
            <h2>
              2. <strong>How We Use Your Information</strong>
            </h2>
            <p>
              We use the information we collect to:
              <ul className="list-disc pl-10">
                <li>Provide, operate, and maintain CapyTube.</li>
                <li>Process transactions and send you order confirmations.</li>
                <li>Improve and personalize your experience on our platform.</li>
                <li>Respond to your inquiries, provide support, and communicate with you.</li>
                <li>Analyze usage and improve our services, content, and user experience.</li>
                <li>Send marketing communications (only with your consent).</li>
                <li>Prevent fraudulent transactions and monitor security risks.</li>
              </ul>
            </p>
          </div>

          <div>
            <h2>
              3. <strong>Sharing Your Information</strong>
            </h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your information
              with:
              <ul className="list-disc pl-10">
                <li>
                  Service Providers: We may share information with third-party service providers who assist us in
                  delivering our services (e.g., payment processors, hosting providers, analytics).
                </li>
                <li>
                  Legal Compliance: We may disclose your information to comply with any applicable laws, regulations,
                  legal processes, or government requests.
                </li>
                <li>
                  Business Transfers: In the event of a merger, acquisition, or sale of assets, your information may be
                  transferred as part of that transaction.
                </li>
                <li>
                  With Your Consent: We may share your information with third parties when you give us explicit consent
                  to do so.
                </li>
              </ul>
            </p>
          </div>

          <div>
            <h2>
              4. <strong>Your Rights and Choices</strong>
            </h2>
            <p>
              You have the following rights regarding your information:
              <ul>
                <li>
                  Access & Correction: You may access and update your personal information at any time by logging into
                  your account.
                </li>
                <li>
                  Opt-Out of Communications: You can opt out of receiving marketing emails by following the unsubscribe
                  instructions provided in our emails.
                </li>
                <li>
                  Data Deletion: You can request that we delete your personal information by contacting us at [insert
                  contact email]. We will process your request subject to applicable laws.
                </li>
              </ul>
            </p>
          </div>

          <div>
            <h2>
              5. <strong>Data Security</strong>
            </h2>
            <p>
              We implement industry-standard security measures to protect your information from unauthorized access,
              use, or disclosure. However, no method of transmission over the internet is 100% secure. We cannot
              guarantee the absolute security of your data.
            </p>
          </div>

          <div>
            <h2>
              6. <strong>Children's Privacy</strong>
            </h2>
            <p>
              CapyTube is not intended for use by individuals under the age of 13. We do not knowingly collect personal
              information from children under 13. If we learn that we have inadvertently collected such information, we
              will take steps to delete it.
            </p>
          </div>

          <div>
            <h2>
              7. <strong>Changes to This Privacy Policy</strong>
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal
              requirements. We will notify you of any significant changes by posting the new Privacy Policy on this page
              and updating the effective date at the top.
            </p>
          </div>

          <div>
            <h2>
              8. <strong>Contact Us</strong>
            </h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us
              at:
            </p>
            <p>
              Email: [insert contact email]
              <br />
              Address: [insert company address]
            </p>

            <p>This Privacy Policy was last updated on [Insert Date]</p>
          </div>
        </div>
      </div>

      {!isMobile && <Footer />}
    </>
  );
};

export default PrivacyPolicy;
