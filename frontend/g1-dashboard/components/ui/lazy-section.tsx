"use client";

import React, { ReactNode } from "react";
import { useInView } from "react-intersection-observer";

interface LazySectionProps {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: string;
}

export function LazySection({ children, rootMargin = "300px", minHeight = "200px" }: LazySectionProps) {
  const { ref, inView } = useInView({
    rootMargin,
    triggerOnce: true, // Only trigger once, stay mounted after
  });

  return (
    <div ref={ref} style={{ minHeight, width: "100%" }}>
      {inView ? children : null}
    </div>
  );
}
