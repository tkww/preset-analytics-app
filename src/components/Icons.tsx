import React from 'react';

const wrap = (path: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

export const IconUsers = () => wrap(<>
  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
</>);

export const IconShield = () => wrap(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
export const IconRefresh = () => wrap(<><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6l3 3" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6l-3-3" /></>);
