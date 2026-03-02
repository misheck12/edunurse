import React from "react";

/** Site-wide defaults – update SITE_URL before deploying to production */
const SITE_NAME = "EduNurse Pro";
const SITE_URL = import.meta.env.VITE_SITE_URL ?? "https://edunurse.pro";
const DEFAULT_DESCRIPTION =
  "AI-powered lesson plan generator for nursing and midwifery educators. Create curriculum-aligned lesson plans, clinical teaching plans, OSCE stations, and assessments in minutes.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SEOProps {
  /** Page title – will be suffixed with " | EduNurse Pro" */
  title?: string;
  /** Page description for search engines (max ~155 chars) */
  description?: string;
  /** Canonical path, e.g. "/create" – full URL is built automatically */
  canonicalPath?: string;
  /** Override the default Open Graph image URL */
  ogImage?: string;
  /** Open Graph type – defaults to "website" */
  ogType?: string;
  /** Additional keywords for the meta keywords tag */
  keywords?: string;
  /** Set to true to tell crawlers not to index this page */
  noIndex?: boolean;
}

/**
 * Drop-in SEO component that renders `<title>`, `<meta>`, and `<link>`
 * tags directly – React 19 automatically hoists them into `<head>`.
 *
 * Usage:
 * ```tsx
 * <SEO title="Create Lesson Plan" description="..." canonicalPath="/create" />
 * ```
 */
const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  keywords,
  noIndex = false,
}) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : undefined;

  return (
    <>
      {/* Primary meta */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </>
  );
};

export default SEO;
