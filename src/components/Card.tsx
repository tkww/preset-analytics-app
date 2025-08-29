import React from 'react';

interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, actions, children, className }) => {
  return (
    <section className={`card ${className || ''}`.trim()}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
};
