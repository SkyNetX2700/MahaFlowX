import React from "react";
import { useLanguage } from "@/i18n";

export const BrandLogo = ({ light = false, testId }) => {
  const { t } = useLanguage();
  return <div className={`brand-mark ${light ? "light" : ""}`} data-testid={testId}>
    <img
      className="brand-logo-image"
      src="/mahaflow-logo.webp"
      alt="MahaFlow bus and railway logo"
      data-testid={`${testId}-image`}
    />
    <span className="brand-wordmark">
      <b>MahaFlow</b>
      <small>{t("brand.tagline")}</small>
    </span>
  </div>;
};