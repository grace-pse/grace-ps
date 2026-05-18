import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ accent, className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={[
        'bg-white border border-n-150 rounded-r3 shadow-sh1',
        accent ? 'border-l-[3px] border-l-a-500' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';
