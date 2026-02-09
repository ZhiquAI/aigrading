import React from 'react';
import { Save, Loader2 } from 'lucide-react';

interface StickyFooterProps {
    onSave: () => void;
    isSaving?: boolean;
    disabled?: boolean;
}

/**
 * StickyFooter - 固定底部栏
 * 保存按钮
 */
const StickyFooter: React.FC<StickyFooterProps> = ({
    onSave,
    isSaving = false,
    disabled = false
}) => {
    return (
        <footer className="sticky bottom-0 z-10 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button
                onClick={onSave}
                disabled={isSaving || disabled}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        保存中...
                    </>
                ) : (
                    <>
                        <Save className="w-5 h-5" />
                        保存细则
                    </>
                )}
            </button>
        </footer>
    );
};

export default StickyFooter;
