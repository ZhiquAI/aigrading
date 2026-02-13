export const copyText = async (value: string): Promise<void> => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("没有可复制的内容");
  }

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error("当前环境不支持剪贴板写入");
  }

  await navigator.clipboard.writeText(normalized);
};
