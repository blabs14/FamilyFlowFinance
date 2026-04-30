import React from 'react';
import { Button } from '../../components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, ctaLabel, onCta, icon, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className ?? ''}`}>
      {icon && <div className="text-4xl text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {onCta && ctaLabel && (
        <Button onClick={onCta}>{ctaLabel}</Button>
      )}
    </div>
  );
}
