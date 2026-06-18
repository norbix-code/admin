// Minimal inline icon set (clean-room, MIT). A few outline glyphs hand-drawn
// as SVG paths so we don't need an icon-library dependency. Keeping the
// dependency surface small is intentional (security + bundle size).

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const DocCheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M9 13l2 2 4-4" />
  </svg>
);

export const SignOutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 4H6v16h9" />
    <path d="M11 12h10" />
    <path d="M18 9l3 3-3 3" />
  </svg>
);
