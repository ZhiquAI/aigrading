'use client';

import type { ReactNode } from 'react';
import { adminTokens, adminCx } from '../_styles/tokens';

type AdminPageHeaderProps = {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    className?: string;
};

export default function AdminPageHeader({
    title,
    subtitle,
    actions,
    className,
}: AdminPageHeaderProps) {
    return (
        <div className={adminCx('flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8', className)}>
            <div>
                <h1 className={adminTokens.headerTitle}>{title}</h1>
                {subtitle && <p className={adminTokens.headerSubtitle}>{subtitle}</p>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
        </div>
    );
}
