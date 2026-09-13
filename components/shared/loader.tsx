"use client";

import { useEffect } from "react";

interface LoaderProps {
  label?: string;
  size?: string;
  className?: string;
}

export function Loader({
  label,
  size = "45",
  className = "",
}: LoaderProps) {
  useEffect(() => {
    import("ldrs").then(({ bouncy }) => {
      bouncy.register();
    });
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <l-bouncy
        size={size}
        speed="1.75"
        color="var(--primary)"
      />

      {label && (
        <p className="text-sm text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}