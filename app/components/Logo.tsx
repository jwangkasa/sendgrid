import Image from 'next/image';

const LOGO_URL =
  'https://hatchevent.com/wp-content/uploads/2026/03/ChatGPT-Image-Mar-31-2026-10_50_02-AM.png';

interface LogoProps {
  /** Size variant — sm = 68px (header), md = 68px (login) */
  size?: 'sm' | 'md';
  className?: string;
}

export function Logo({ size = 'sm', className = '' }: LogoProps) {
  const px = 68;
  return (
    <Image
      src={LOGO_URL}
      alt="HatchEvent"
      width={px}
      height={px}
      className={`rounded-lg object-contain ${className}`}
      priority
    />
  );
}
