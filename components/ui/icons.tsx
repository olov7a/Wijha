import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ className = "size-5", children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14 6-6 6 6 6" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </Icon>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M4 21h17" />
      <path d="M7.5 8h3M7.5 12h3M7.5 16h3M17 14h.01M17 17.5h.01" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6c0 5-7 9.4-7 9.4Z" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v6c0 4.3-3 7.2-7 8.5-4-1.3-7-4.2-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
      <path d="M3.5 10.5h17M16.5 14.5h.01" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V5m0 0L8 9m4-4 4 4M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" />
    </Icon>
  );
}

export function BedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 19v-8h18v8M3 11V7M3 19h18" />
      <path d="M6.5 11V9.5A1.5 1.5 0 0 1 8 8h3a1.5 1.5 0 0 1 1.5 1.5V11M12.5 11V9.5A1.5 1.5 0 0 1 14 8h3a1.5 1.5 0 0 1 1.5 1.5V11" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.2a3 3 0 0 1 4 0" />
      <circle cx="12" cy="19" r=".7" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function SnowflakeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 5l2.5 2.5L14.5 5M9.5 19l2.5-2.5 2.5 2.5" />
    </Icon>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c3.3 0 6-2.4 6-5.5 0-4-3.6-6.6-6-11.5-2.4 4.9-6 7.5-6 11.5C6 18.6 8.7 21 12 21Z" />
      <path d="M12 17.5c1.2 0 2-.9 2-2 0-1.4-1.2-2.3-2-3.9-.8 1.6-2 2.5-2 3.9 0 1.1.8 2 2 2Z" />
    </Icon>
  );
}

export function LiftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M12 3.5v17M8.5 8l1.5-1.5L11.5 8M12.5 16l1.5 1.5 1.5-1.5" />
    </Icon>
  );
}

export function WashingMachineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M4 8h16" />
      <circle cx="12" cy="14.5" r="3.5" />
      <path d="M7 5.8h.01M10 5.8h.01" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </Icon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H6l-2.5 2v-9.5A7.5 7.5 0 0 1 11 4.5h1.5A7.5 7.5 0 0 1 20 12Z" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9ZM9.5 20a2.5 2.5 0 0 0 5 0" />
    </Icon>
  );
}

export function ArrowUpLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 17 7 7m0 0v7m0-7h7" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h8l4 4v13H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5v4h4M8.5 12h7M8.5 15.5h5" />
    </Icon>
  );
}

export function PieIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" />
      <path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15V3.8Z" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5h3l1.2 3.6-2 1.4a11 11 0 0 0 4.3 4.3l1.4-2 3.6 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 6 5.7a2 2 0 0 1 2-2.2Z" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </Icon>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M3.5 9.5h17M7 14.5h3" />
    </Icon>
  );
}
