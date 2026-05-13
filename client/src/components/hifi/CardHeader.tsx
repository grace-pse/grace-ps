import type { ReactNode } from 'react';

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pills?: ReactNode;
}

export function CardHeader({ title, subtitle, actions, pills }: CardHeaderProps) {
  return (
    <div className="px-[14px] pt-[10px] pb-2 pr-9 border-b border-n-150">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-semibold tracking-[-0.2px] text-n-900">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11.5px] text-n-500 tracking-[-0.05px] mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      {pills && <div className="flex flex-wrap gap-1 mt-2">{pills}</div>}
    </div>
  );
}
