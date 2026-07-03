import type { ReactNode } from "react";

type JasonMood = "idle" | "thinking" | "happy" | "error" | "success";

type JasonMascotProps = {
  mood?: JasonMood;
  size?: number;
  label?: string;
};

const eyeShapes: Record<JasonMood, ReactNode> = {
  idle: (
    <>
      <rect x="40" y="49" width="14" height="4" rx="2" fill="#A1A1AA" />
      <rect x="66" y="49" width="14" height="4" rx="2" fill="#A1A1AA" />
    </>
  ),
  thinking: (
    <>
      <circle cx="47" cy="51" r="7" fill="#10B981" opacity="0.45" />
      <circle cx="73" cy="49" r="7" fill="#10B981" />
    </>
  ),
  happy: (
    <>
      <circle cx="47" cy="50" r="7" fill="#10B981" />
      <circle cx="73" cy="50" r="7" fill="#10B981" />
    </>
  ),
  error: (
    <>
      <path d="M41 44L53 56M53 44L41 56" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />
      <path d="M67 44L79 56M79 44L67 56" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  success: (
    <>
      <path d="M40 51L45 56L54 44" stroke="#10B981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 51L71 56L80 44" stroke="#10B981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

const antennaColor: Record<JasonMood, string> = {
  idle: "#A1A1AA",
  thinking: "#38BDF8",
  happy: "#10B981",
  error: "#EF4444",
  success: "#10B981",
};

export function JasonMascot({
  mood = "idle",
  size = 120,
  label = "Jason mascot",
}: JasonMascotProps) {
  const activeColor = antennaColor[mood];
  const shouldPulse = mood === "thinking" || mood === "success" || mood === "error";

  return (
    <svg
      aria-label={label}
      role="img"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
    >
      <path
        d="M60 18V10"
        stroke={activeColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="8" r="4" fill={activeColor}>
        {shouldPulse ? (
          <animate
            attributeName="opacity"
            values="0.45;1;0.45"
            dur={mood === "error" ? "0.55s" : "1.4s"}
            repeatCount="indefinite"
          />
        ) : null}
      </circle>
      <rect
        x="18"
        y="18"
        width="84"
        height="84"
        rx="26"
        fill="#18181B"
        stroke="#3F3F46"
      />
      <rect x="27" y="27" width="66" height="66" rx="20" fill="#09090B" opacity="0.58" />
      {eyeShapes[mood]}
      <text
        x="60"
        y="79"
        textAnchor="middle"
        fontSize="25"
        fontWeight="700"
        fill="#FAFAFA"
      >
        {"{}"}
      </text>
    </svg>
  );
}
