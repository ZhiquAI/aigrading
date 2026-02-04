import React from 'react';
import RubricCreateModal from './RubricCreateModal';

interface RubricDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * RubricDrawer - 评分细则弹窗容器
 *
 * 侧边栏模式使用全屏覆盖弹窗，避免抽屉占用空间
 */
export default function RubricDrawer({ isOpen, onClose }: RubricDrawerProps) {
    return <RubricCreateModal isOpen={isOpen} onClose={onClose} />;
}
