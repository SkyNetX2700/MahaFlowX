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

export const formatTime12 = value => {
  if (!value) return "—";
  const text = String(value);
  const match = text.match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour)) return text;
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${minute} ${suffix}`;
};

export const formatDateTime12 = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatTime12(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};