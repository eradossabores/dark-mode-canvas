"use client";

import { motion, type Variants } from "framer-motion";

interface AnimatedMenuToggleProps {
  isOpen: boolean;
  toggle: () => void;
  className?: string;
  size?: number;
  strokeColor?: string;
}

const Path = ({
  variants,
  d,
  transition,
  strokeColor = "currentColor",
}: {
  d?: string;
  variants: Variants;
  transition?: { duration: number };
  strokeColor?: string;
}) => (
  <motion.path
    fill="transparent"
    strokeWidth="3"
    stroke={strokeColor}
    strokeLinecap="round"
    d={d}
    variants={variants}
    transition={transition}
  />
);

export function AnimatedMenuToggle({
  isOpen,
  toggle,
  className = "",
  size = 23,
  strokeColor = "currentColor",
}: AnimatedMenuToggleProps) {
  return (
    <motion.button
      onClick={toggle}
      animate={isOpen ? "open" : "closed"}
      initial={false}
      className={`outline-none border-none cursor-pointer bg-transparent p-1 ${className}`}
      aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
    >
      <svg width={size} height={size} viewBox="0 0 23 23">
        <Path
          strokeColor={strokeColor}
          variants={{
            closed: { d: "M 2 2.5 L 20 2.5" },
            open: { d: "M 3 16.5 L 17 2.5" },
          }}
        />
        <Path
          strokeColor={strokeColor}
          d="M 2 9.423 L 20 9.423"
          variants={{
            closed: { opacity: 1 },
            open: { opacity: 0 },
          }}
          transition={{ duration: 0.1 }}
        />
        <Path
          strokeColor={strokeColor}
          variants={{
            closed: { d: "M 2 16.346 L 20 16.346" },
            open: { d: "M 3 2.5 L 17 16.346" },
          }}
        />
      </svg>
    </motion.button>
  );
}
