import React from "react";
import type { CSSProperties, ReactNode } from "react";

type ScreenHeaderProps = {
  variant: "brandBand" | "inverseCard";
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
  align?: "center" | "left";
  topInset?: boolean;
};

export function ScreenHeader({
  variant,
  title,
  eyebrow,
  description,
  backHref,
  actions,
  align = "left",
  topInset = false,
}: ScreenHeaderProps) {
  const isBrandBand = variant === "brandBand";

  return (
    <header
      style={{
        ...styles.base,
        ...(isBrandBand ? styles.brandBand : styles.inverseCard),
        ...(isBrandBand && topInset ? styles.brandBandInsetTop : null),
      }}
    >
      {backHref ? (
        <div style={styles.topRow}>
          <a href={backHref} style={{ ...styles.backAction, ...(isBrandBand ? styles.brandBackAction : styles.cardBackAction) }}>
            뒤로
          </a>
        </div>
      ) : null}

      <div style={{ ...styles.contentStack, ...(align === "center" ? styles.centerAligned : null) }}>
        {eyebrow ? (
          <p style={{ ...styles.eyebrow, ...(isBrandBand ? styles.brandEyebrow : styles.cardEyebrow) }}>{eyebrow}</p>
        ) : null}
        <h1 style={{ ...styles.title, ...(isBrandBand ? styles.brandTitle : styles.cardTitle), textAlign: align }}>
          {title}
        </h1>
        {description ? <div style={{ width: "100%", textAlign: align }}>{description}</div> : null}
      </div>

      {actions ? <div style={styles.actions}>{actions}</div> : null}
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  base: {
    display: "grid",
  },
  brandBand: {
    gap: 12,
    padding: "18px 20px",
    background: "#1f5fd6",
    color: "#f8fbff",
  },
  brandBandInsetTop: {
    paddingTop: 20,
  },
  inverseCard: {
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: "#13233f",
    color: "#f8fbff",
  },
  topRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  backAction: {
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.4,
  },
  brandBackAction: {
    color: "#ffffff",
  },
  cardBackAction: {
    color: "#d7e0f0",
  },
  contentStack: {
    display: "grid",
    gap: 4,
  },
  centerAligned: {
    justifyItems: "center",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  brandEyebrow: {
    color: "rgba(255,255,255,0.82)",
  },
  cardEyebrow: {
    color: "#b7c6e5",
  },
  title: {
    margin: 0,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },
  brandTitle: {
    fontSize: "clamp(1.75rem, 4vw, 2.1rem)",
    fontWeight: 800,
  },
  cardTitle: {
    fontSize: "clamp(2rem, 4vw, 3.5rem)",
    fontWeight: 800,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 10,
  },
};
