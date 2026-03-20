import React from 'react';
import { MessageCircle } from 'lucide-react';
import SEO from '../src/components/SEO';

const Help: React.FC = () => {
  // Replace with your actual WhatsApp group link
  const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/YOUR_GROUP_INVITE_CODE';

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      <SEO
        title="Help & Support"
        description="Get help and support for EduNurse Pro. Join our WhatsApp community of nursing and midwifery educators."
        canonicalPath="/help"
        keywords="EduNurse support, nursing educator help, WhatsApp community"
      />
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:p-12 text-center">
          {/* WhatsApp Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <MessageCircle size={40} className="text-green-600" />
          </div>

          {/* Heading */}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Help & Support
          </h1>
          
          {/* Description */}
          <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
            Join our WhatsApp community to get instant help, share ideas, and connect with other nursing and midwifery educators.
          </p>

          {/* WhatsApp Button */}
          <a
            href={WHATSAPP_GROUP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-green-600 px-5 py-4 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-xl sm:w-auto sm:px-8 sm:text-base"
          >
            <MessageCircle size={24} />
            <span>Join WhatsApp Support Group</span>
          </a>

          {/* Additional Info */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Available Mon-Fri, 9am - 5pm CAT
            </p>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-3">What you can get help with:</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Creating lesson plans and OSCE stations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Exporting documents to Word and PDF</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Curriculum mapping and alignment</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Account and billing questions</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Help;
