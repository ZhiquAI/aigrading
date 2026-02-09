import React from 'react';
import RubricEditPanel from '../rubric/RubricEditPanel';

interface RubricDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * RubricDrawer - 评分细则弹窗容器
 *
 * 使用 Chrome Side Panel 适配版 UI
 */
export default function RubricDrawer({ isOpen, onClose }: RubricDrawerProps) {
    return <RubricEditPanel isOpen={isOpen} onClose={onClose} />;
}
