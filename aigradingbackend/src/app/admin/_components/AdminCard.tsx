'use client';

import type { ReactNode } from 'react';
import { adminCx, adminTokens } from '../_styles/tokens';

type AdminCardProps = {
    children: ReactNode;
    className?: string;
    dense?: boolean;
};

export default function AdminCard({ children, className, dense }: AdminCardProps) {
    const base = dense ? adminTokens.cardDense : adminTokens.card;
    return <div className={adminCx(base, className)}>{children}</div>;
}
