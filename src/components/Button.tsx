import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface ButtonProps {
  id?: string;
  title: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClass?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
}

export default function Button({
  id,
  title,
  leftIcon,
  rightIcon,
  containerClass,
  to,
  href,
  onClick,
}: ButtonProps) {
  const className = clsx(
    'relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
    'text-xs font-black uppercase tracking-[0.28em]',
    'transition-all duration-300 hover:-translate-y-0.5 active:scale-95',
    'bg-yellow-300 text-black',
    containerClass
  );

  if (to) {
    return (
      <Link id={id} to={to} className={className}>
        {leftIcon}
        {title}
        {rightIcon}
      </Link>
    );
  }

  if (href) {
    return (
      <a id={id} href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {leftIcon}
        {title}
        {rightIcon}
      </a>
    );
  }

  return (
    <button id={id} type="button" onClick={onClick} className={className}>
      {leftIcon}
      {title}
      {rightIcon}
    </button>
  );
}
