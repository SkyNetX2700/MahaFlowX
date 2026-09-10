import React from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const SectionHeader = ({ eyebrow, title, description, action }) => (
  <header className="section-heading" data-testid={`section-${slug(title)}`}>
    <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    {action}
  </header>
);

export const LoadingState = ({ label = "Loading live data…" }) => (
  <div className="data-state" data-testid="data-loading"><LoaderCircle className="spin"/><b>{label}</b></div>
);

export const EmptyState = ({ icon: Icon = AlertTriangle, title, message, testId }) => (
  <div className="data-state" data-testid={testId}><Icon/><b>{title}</b><span>{message}</span></div>
);

export const ErrorState = ({ message }) => (
  <div className="data-state error" data-testid="data-error"><AlertTriangle/><b>Unable to load data</b><span>{message}</span></div>
);

export const StatusBadge = ({ value, testId }) => (
  <span className={`data-badge ${slug(value)}`} data-testid={testId}>{value}</span>
);