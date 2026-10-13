import Link from 'next/link';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'onDark';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl text-center font-semibold tracking-tightish transition-[transform,box-shadow,background-color,border-color,filter] duration-200 ease-out active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55';
const variants: Record<Variant, string> = {
  // Orange is reserved for the main call to action; navy text keeps contrast above 4.5:1.
  primary: 'bg-brand-cta text-navy shadow-cta hover:brightness-105 hover:-translate-y-0.5',
  secondary: 'bg-brand-royal text-white shadow-royal hover:brightness-110 hover:-translate-y-0.5',
  outline: 'border border-line bg-surface text-ink shadow-xs hover:border-royal/50 hover:bg-royal/[0.03] hover:shadow-card',
  ghost: 'text-ink hover:bg-ink/[0.06]',
  danger: 'bg-bad text-white shadow-xs hover:brightness-110',
  onDark: 'border border-white/25 bg-white/[0.06] text-white hover:border-white/50 hover:bg-white/[0.12]',
};
const sizes: Record<Size, string> = {
  sm: 'tap min-h-[38px] px-3.5 py-1.5 text-sm',
  md: 'min-h-[46px] px-5 py-2 text-sm',
  lg: 'min-h-[54px] px-7 py-3 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
