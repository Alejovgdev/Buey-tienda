import React from "react";
import "./SocialButtom.css";

interface SocialButtonProps {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}

export default function SocialButton({ href, ariaLabel, children }: SocialButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="relative w-11 h-11 flex items-center justify-center rounded-full text-amber-500 bg-black overflow-hidden"
    >
      {children}

      {/* Borde animado */}
      <span className="absolute top-0 left-0 w-full h-full border-2 border-amber-500 rounded-full animate-spin-border-half"></span>
    </a>
  );
}