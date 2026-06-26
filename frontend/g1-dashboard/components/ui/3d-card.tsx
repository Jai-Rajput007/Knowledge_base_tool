"use client";

import React, { useRef } from "react";

interface Floating3DCardProps {
  title: string;
  description: string;
  imageSrc: string;
  buttonText: string;
  onButtonClick?: () => void;
  tag?: string;
}

export const Floating3DCard: React.FC<Floating3DCardProps> = ({
  title,
  description,
  imageSrc,
  buttonText,
  onButtonClick,
  tag
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const card = cardRef.current;
    if (!card) return;

    const { left, top, width, height } = card.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    // Calculate rotation angles
    const rotateX = ((y - height / 2) / height) * 15;
    const rotateY = ((x - width / 2) / width) * -15;

    // Apply 3D transform with a slight scale on hover
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    // Reset transform on mouse leave
    card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  };

  return (
    <div
      className="flex w-full justify-center"
      style={{ perspective: "1000px" }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative w-full rounded-xl border border-border bg-card p-6 shadow-lg transition-transform duration-300 ease-out hover:shadow-2xl hover:border-primary/50"
        style={{ transformStyle: "preserve-3d" }}
      >
        <h2
          className="text-xl font-bold text-foreground sm:text-2xl"
          style={{ transform: "translateZ(50px)" }}
        >
          {title}
        </h2>

        <p
          className="mt-2 text-sm text-muted-foreground sm:text-base min-h-[60px]"
          style={{ transform: "translateZ(60px)" }}
        >
          {description}
          {tag && (
            <><br/><br/><span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">{tag}</span></>
          )}
        </p>

        <div
          className="mt-6 w-full"
          style={{ transform: "translateZ(80px)" }}
        >
          <img
            src={imageSrc}
            alt={title}
            className="h-40 w-full rounded-lg object-cover transition-shadow duration-300 sm:h-48 group-hover:shadow-xl opacity-90 group-hover:opacity-100"
          />
        </div>

        <div className="mt-8 flex items-center justify-end relative z-50">
          <button
            onPointerDown={(e) => { e.stopPropagation(); onButtonClick?.(); }}
            onClick={(e) => { e.stopPropagation(); onButtonClick?.(); }}
            className="relative z-50 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-all duration-300 hover:bg-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
