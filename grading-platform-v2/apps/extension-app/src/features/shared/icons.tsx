type IconProps = {
  className?: string;
};

export const GearIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
  </svg>
);

export const WandIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m4 20l9-9" />
    <path d="m6 10l8 8" />
    <path d="M15 4v3" />
    <path d="M13.5 5.5H16.5" />
    <path d="M19 8v2" />
    <path d="M18 9h2" />
  </svg>
);

export const FileIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 13h6" />
    <path d="M9.5 17h6" />
  </svg>
);

export const PuzzleIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9.5 3h5v3.1a1.9 1.9 0 1 1 0 3.8V13H18v5h-3.1a1.9 1.9 0 1 1-3.8 0V15H6v-5h3.1a1.9 1.9 0 1 0 0-3.8V3z" />
  </svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
    <circle cx="12" cy="9" r="3" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const ClipboardIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="4.5" width="10" height="15" rx="2" />
    <path d="M9.5 4.5h5v2h-5z" />
    <path d="M9.5 10h5" />
    <path d="M9.5 14h5" />
  </svg>
);

export const GridIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export const HistoryIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9a7 7 0 1 1 2.1 5" />
    <path d="M5 4v5h5" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>
);

export const KeyIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="7.5" cy="12.5" r="3.5" />
    <path d="M11 12.5h9" />
    <path d="M17 12.5V10" />
    <path d="M20 12.5V10.5" />
  </svg>
);

export const RefreshIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v6h-6" />
  </svg>
);

export const SaveIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h12l2 2v14H5z" />
    <path d="M8 4v5h8V4" />
    <path d="M8.5 15h7" />
  </svg>
);

export const PlugIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 7v5a4 4 0 0 0 8 0V7" />
    <path d="M9 4v3" />
    <path d="M15 4v3" />
    <path d="M12 16v4" />
  </svg>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 5 6v5c0 5 3.4 8.6 7 10 3.6-1.4 7-5 7-10V6z" />
    <path d="M9.4 12.2 11 13.8l3.6-3.6" />
  </svg>
);
