"use client";

import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, DivProps>(function Card(
  { style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        borderRadius: 24,
        border: "1px solid #dfe5ef",
        background: "#ffffff",
        boxShadow: "0 18px 40px rgba(18, 31, 54, 0.08)",
        ...style,
      }}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(function CardContent(
  { style, ...props },
  ref,
) {
  return <div ref={ref} style={{ padding: 16, ...style }} {...props} />;
});
