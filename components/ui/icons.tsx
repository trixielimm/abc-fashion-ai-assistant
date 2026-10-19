type IconProps = {
  className?: string;
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3.5 13.25c.6-2.4 2.3-3.5 4.5-3.5s3.9 1.1 4.5 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BagIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.25 5.25h9.5l-.7 7.1a1 1 0 0 1-1 .9H4.95a1 1 0 0 1-1-.9l-.7-7.1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M6 5.25V4.1A2 2 0 0 1 8 2.1 2 2 0 0 1 10 4.1v1.15"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function ChevronIcon({
  className,
  direction = "left",
}: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <path
          d="M9.5 3.5 5.5 8l4 4.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ) : (
        <path
          d="M6.5 3.5 10.5 8l-4 4.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      )}
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 5.25h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 9h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 12.75h12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 4 14 14" stroke="currentColor" strokeWidth="1.2" />
      <path d="M14 4 4 14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 1.4 1.3 7.7v10.9h7V13.4h3.4v5.2h7V7.7L10 1.4Z" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="1.4" y="1.4" width="7.6" height="7.6" rx="1.2" />
      <rect x="11" y="1.4" width="7.6" height="7.6" rx="1.2" />
      <rect x="1.4" y="11" width="7.6" height="7.6" rx="1.2" />
      <rect x="11" y="11" width="7.6" height="7.6" rx="1.2" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.6 3.8Q7.6 10 13.2 10 7.6 10 7.6 16.2 7.6 10 2 10 7.6 10 7.6 3.8Z" />
      <path d="M16 1.9Q16 4.9 18.7 4.9 16 4.9 16 7.9 16 4.9 13.3 4.9 16 4.9 16 1.9Z" />
      <path d="M15.4 12.4Q15.4 15.1 17.8 15.1 15.4 15.1 15.4 17.8 15.4 15.1 13 15.1 15.4 15.1 15.4 12.4Z" />
    </svg>
  );
}

export function ShoppingBagIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.2"
        y="3"
        width="15.6"
        height="14.8"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="5.6" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M2.6 17.8V16a5.4 5.4 0 0 1 5.4-5.4h4a5.4 5.4 0 0 1 5.4 5.4v1.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.8 6.3 4.4 9 10.2 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 1 10.2 2.5v3.4c0 2.4-1.7 4.1-4.2 5.1-2.5-1-4.2-2.7-4.2-5.1V2.5L6 1Z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M4.2 6 5.6 7.4 8 4.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronUpDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 5.6 7 2.4l3 3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M4 8.4 7 11.6l3-3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1.5 1.7h13v10.6h-13z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 12.3v3.2l3-3.2z" fill="currentColor" />
    </svg>
  );
}

export function MarkIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 0 10 8.5H0z" />
    </svg>
  );
}
