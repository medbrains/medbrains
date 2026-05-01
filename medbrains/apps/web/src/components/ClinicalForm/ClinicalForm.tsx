import type { ReactNode } from "react";
import s from "./ClinicalForm.module.scss";

interface ClinicalFormProps {
  title: ReactNode;
  /** italic accent clause inside title — wrapped in <em> with copper colour */
  titleAccent?: ReactNode;
  /** mono-uppercase metadata under the title (e.g. "UH-2026-00342 · drafted 14:22 IST") */
  subtitle?: ReactNode;
  /** rows / sections — typically <FormRow> children */
  children: ReactNode;
  /** mono-uppercase line on the left of the footer (e.g. "Auto-saved · 14:24 IST") */
  footerMeta?: ReactNode;
  /** action buttons on the right of the footer */
  actions?: ReactNode;
  /** form submit handler */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function ClinicalForm({
  title,
  titleAccent,
  subtitle,
  children,
  footerMeta,
  actions,
  onSubmit,
}: ClinicalFormProps) {
  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      <div className={s.head}>
        <h3>
          {title}
          {titleAccent && (
            <>
              {" "}
              <em>{titleAccent}</em>
            </>
          )}
        </h3>
        {subtitle && <div className={s.sub}>{subtitle}</div>}
      </div>

      {children}

      {(footerMeta || actions) && (
        <div className={s.foot}>
          <div className={s.meta}>{footerMeta}</div>
          {actions && <div className={s.actions}>{actions}</div>}
        </div>
      )}
    </form>
  );
}

interface FormSectionProps {
  /** mono-eyebrow number/code (e.g. "01", "02") */
  num?: string;
  /** sentence-case section name */
  name: string;
  children: ReactNode;
}

export function FormSection({ num, name, children }: FormSectionProps) {
  return (
    <div className={s.section}>
      <div className={s.sectionLabel}>
        {num && <span className={s.num}>{num}</span>}
        <span className={s.name}>{name}</span>
      </div>
      {children}
    </div>
  );
}

interface FormRowProps {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
}

export function FormRow({ label, required, children }: FormRowProps) {
  return (
    <div className={s.row}>
      <div className={s.lhs}>
        {label}
        {required && <span className={s.req}>*</span>}
      </div>
      <div className={s.rhs}>{children}</div>
    </div>
  );
}
