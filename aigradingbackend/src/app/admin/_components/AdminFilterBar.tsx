'use client';

import type { ReactNode } from 'react';
import { adminCx, adminTokens } from '../_styles/tokens';

type AdminFilterBarProps = {
    children: ReactNode;
    className?: string;
};

export default function AdminFilterBar({ children, className }: AdminFilterBarProps) {
    return (
        <div className={adminCx(adminTokens.filterBar, className)}>
            {children}
        </div>
    );
}
