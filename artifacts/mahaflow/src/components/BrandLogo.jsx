import React from "react";

export const BrandLogo = ({ light = false, testId }) => (
  <div className={`brand-mark ${light ? "light" : ""}`} data-testid={testId}>
    <img
      className="brand-logo-image"
      src="/mahaflow-logo.webp"
      alt="MahaFlow bus and railway logo"
      data-testid={`${testId}-image`}
    />
    <span className="brand-wordmark">
      <b>MahaFlow</b>
      <small>Smarter Travel. A Better Maharashtra.</small>
    </span>
  </div>
);