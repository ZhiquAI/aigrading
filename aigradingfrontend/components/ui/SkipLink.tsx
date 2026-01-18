/**
 * SkipLink.tsx - 跳过导航链接
 * 
 * 为键盘用户提供快速跳过导航区域的功能
 */

import React from 'react';

interface SkipLinkProps {
    targetId: string;
    children?: React.ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
    targetId,
    children = '跳过导航'
}) => {
    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <a
            href={`#${targetId}`}
            onClick={handleClick}
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 
                 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg 
                 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
            {children}
        </a>
    );
};

export default SkipLink;
