import React, { useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { languageOptions, useLanguage } from "@/i18n";

export const LanguageSwitcher = ({ className = "" }) => {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = languageOptions.find(option => option.code === language) || languageOptions[0];

  return <div className={`language-switcher ${className}`}>
    <button
      className="language-button"
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={t("language.select")}
      data-testid="language-button"
      onClick={() => setOpen(value => !value)}
    >
      <Languages size={16}/>{current.short}<ChevronDown size={14}/>
    </button>
    {open && <div className="language-menu" role="menu" aria-label={t("language.select")}>
      {languageOptions.map(option => <button
        key={option.code}
        type="button"
        role="menuitem"
        className={option.code === language ? "selected" : ""}
        onClick={() => { setLanguage(option.code); setOpen(false); }}
      >
        <span>{option.label}</span><small>{option.short}</small>
      </button>)}
    </div>}
  </div>;
};