import React, { useState, useCallback, useRef } from 'react';
import { CloudUpload, FileText, Eye, CheckCircle, XCircle, Loader2, RefreshCw, Crop, Sliders, Download, Trash2 } from 'lucide-react';
import Button from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import Progress from './ui/Progress';
import { toast } from './Toast';

// 类型定义
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  ocrResult?: OCRResult;
  uploadedAt: Date;
}

interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
  questions: Question[];
}

interface Question {
  id: string;
  number: string;
  type: 'choice' | 'fill' | 'short_answer' | 'essay';
  text: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// UploadArea 组件
interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedFormats?: string[];
  disabled?: boolean;
}

const UploadArea: React.FC<UploadAreaProps> = ({
  onFilesSelected,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedFormats = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'],
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files) as File[];
    handleFiles(files);
  }, [disabled]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    // 验证文件数量
    if (files.length > maxFiles) {
      toast.error(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    // 验证文件格式和大小
    const validFiles = files.filter(file => {
      if (!acceptedFormats.includes(file.type)) {
        toast.error(`文件 ${file.name} 格式不支持`);
        return false;
      }
      if (file.size > maxSize) {
        toast.error(`文件 ${file.name} 超过大小限制 (${maxSize / 1024 / 1024}MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
          ${isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className={`
            p-4 rounded-full
            ${isDragOver ? 'bg-primary-100' : 'bg-gray-100'}
          `}>
            <CloudUpload className={`w-8 h-8 ${isDragOver ? 'text-primary-600' : 'text-gray-400'}`} />
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-gray-500">
              支持格式: JPG, PNG, PDF, HEIC (最大 {maxSize / 1024 / 1024}MB)
            </p>
          </div>

          <Button variant="outline" disabled={disabled}>
            选择文件
          </Button>
        </div>
      </div>
    </div>
  );
};

// FileCard 组件
interface FileCardProps {
  file: UploadedFile;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRecognize: (id: string) => void;
  onReRecognize?: (id: string) => void;
}

const FileCard: React.FC<FileCardProps> = ({
  file,
  onPreview,
  onDelete,
  onRecognize,
  onReRecognize
}) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case 'pending':
        return '等待识别';
      case 'processing':
        return '识别中...';
      case 'success':
        return `识别成功 (${file.ocrResult?.confidence || 0}%)`;
      case 'error':
        return '识别失败';
    }
  };

  const getStatusColor = () => {
    switch (file.status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <FileText className="w-6 h-6 text-gray-600" />
          </div>

          <div className="flex-1">
            <h4 className="font-medium text-gray-900 truncate">
              {file.name}
            </h4>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{new Date(file.uploadedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor()}>
            <div className="flex items-center space-x-1">
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview(file.id)}
            disabled={file.status === 'processing'}
          >
            <Eye className="w-4 h-4 mr-1" />
            预览
          </Button>

          {file.status === 'error' && onReRecognize && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReRecognize(file.id)}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重试
            </Button>
          )}

          {file.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecognize(file.id)}
            >
              开始识别
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(file.id)}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {file.status === 'processing' && (
        <div className="mt-3">
          <Progress value={undefined} className="h-2" />
        </div>
      )}
    </Card>
  );
};

// ImagePreview 组件
interface ImagePreviewProps {
  file: UploadedFile;
  onClose: () => void;
  onEdit: (text: string) => void;
  onReRecognize: () => void;
  onConfirm: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  onClose,
  onEdit,
  onReRecognize,
  onConfirm
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(file.ocrResult?.text || '');

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  };

  const imageStyle = {
    transform: `scale(${scale}) rotate(${rotation}deg)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    transition: 'all 0.3s ease'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">图像预览与识别结果</h3>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="flex h-[calc(90vh-8rem)]">
          {/* 左侧：图像预览 */}
          <div className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
            <div className="relative">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                style={imageStyle}
              />
            </div>
          </div>

          {/* 右侧：控制面板和OCR结果 */}
          <div className="w-96 border-l bg-white flex flex-col">
            {/* 控制面板 */}
            <div className="p-4 border-b">
              <h4 className="font-medium mb-3">图像调整</h4>

              <div className="space-y-3">
                {/* 缩放控制 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">缩放</span>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleZoomOut}>
                      −
                    </Button>
                    <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button variant="outline" size="sm" onClick={handleZoomIn}>
                      +
                    </Button>
                  </div>
                </div>

                {/* 旋转控制 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">旋转</span>
                  <Button variant="outline" size="sm" onClick={handleRotate}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* 亮度控制 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">亮度</span>
                    <span className="text-sm">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* 对比度控制 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">对比度</span>
                    <span className="text-sm">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                  重置
                </Button>
              </div>
            </div>

            {/* OCR 结果 */}
            <div className="flex-1 p-4 overflow-y-auto">
              <h4 className="font-medium mb-3">识别结果</h4>

              {file.ocrResult ? (
                <div className="space-y-3">
                  {/* 状态信息 */}
                  <div className="flex items-center justify-between text-sm">
                    <span>置信度:</span>
                    <Badge variant={file.ocrResult.confidence > 90 ? 'success' : 'warning'}>
                      {file.ocrResult.confidence}%
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>处理时间:</span>
                    <span>{file.ocrResult.processingTime}s</span>
                  </div>

                  {/* 识别文本 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">识别文本:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? '取消' : '编辑'}
                      </Button>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full h-32 p-2 border rounded-lg resize-none"
                        placeholder="编辑识别文本…"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">
                          {file.ocrResult.text}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="space-y-2">
                    {isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onEdit(editedText);
                          setIsEditing(false);
                        }}
                        className="w-full"
                      >
                        保存编辑
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onReRecognize}
                      className="w-full"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      重新识别
                    </Button>

                    <Button
                      size="sm"
                      onClick={onConfirm}
                      className="w-full"
                    >
                      确认无误
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  </div>
                  <p className="text-sm text-gray-500">正在识别中...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 主上传页面组件
const UploadPage: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setIsUploading(true);

    try {
      const newFiles: UploadedFile[] = [];

      for (const file of selectedFiles) {
        // 创建文件URL
        const url = URL.createObjectURL(file);

        // 创建上传文件记录
        const uploadedFile: UploadedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          url,
          status: 'pending',
          uploadedAt: new Date()
        };

        newFiles.push(uploadedFile);
      }

      setFiles(prev => [...prev, ...newFiles]);

      // 自动开始识别
      for (const file of newFiles) {
        await recognizeFile(file.id);
      }

    } catch (error) {
      toast.error('文件上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const recognizeFile = async (fileId: string) => {
    setFiles(prev => prev.map(file =>
      file.id === fileId ? { ...file, status: 'processing' } : file
    ));

    try {
      // 模拟OCR识别过程
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟识别结果
      const mockOCRResult: OCRResult = {
        text: "这是一道数学题的解答过程…\n\n1. 首先计算…\n2. 然后代入…\n3. 最后得到答案…",
        confidence: 95,
        processingTime: 2.3,
        questions: [
          {
            id: 'q1',
            number: '1',
            type: 'short_answer',
            text: '计算下列表达式的值',
            coordinates: { x: 100, y: 200, width: 300, height: 50 }
          }
        ]
      };

      setFiles(prev => prev.map(file =>
        file.id === fileId
          ? { ...file, status: 'success', ocrResult: mockOCRResult }
          : file
      ));

      toast.success('文件识别完成');
    } catch (error) {
      setFiles(prev => prev.map(file =>
        file.id === fileId ? { ...file, status: 'error' } : file
      ));

      toast.error('文件识别失败');
    }
  };

  const handlePreview = (fileId: string) => {
    setSelectedFile(fileId);
  };

  const handleDelete = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
    toast.success('文件已删除');
  };

  const handleRecognize = (fileId: string) => {
    recognizeFile(fileId);
  };

  const handleReRecognize = (fileId: string) => {
    recognizeFile(fileId);
  };

  const handleEdit = (fileId: string, text: string) => {
    setFiles(prev => prev.map(file =>
      file.id === fileId
        ? {
          ...file,
          ocrResult: file.ocrResult
            ? { ...file.ocrResult, text }
            : undefined
        }
        : file
    ));
  };

  const handleConfirm = (fileId: string) => {
    // 确认无误，进入下一步
    toast.success('文件已确认，准备开始批改');
    setSelectedFile(null);
  };

  const selectedFileData = files.find(file => file.id === selectedFile);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                答题卡扫描上传
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-1" />
                导出列表
              </Button>
              <Button disabled={files.length === 0}>
                开始批改
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Upload Area */}
          <UploadArea
            onFilesSelected={handleFilesSelected}
            disabled={isUploading}
          />

          {/* Files List */}
          {files.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  已上传文件 ({files.length})
                </h2>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    全选
                  </Button>
                  <Button variant="outline" size="sm">
                    批量识别
                  </Button>
                  <Button variant="outline" size="sm">
                    批量删除
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                {files.map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onPreview={handlePreview}
                    onDelete={handleDelete}
                    onRecognize={handleRecognize}
                    onReRecognize={handleReRecognize}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {files.length === 0 && !isUploading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <CloudUpload className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                还没有上传任何文件
              </h3>
              <p className="text-gray-500">
                拖拽文件到上方区域或点击选择文件开始上传
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Image Preview Modal */}
      {selectedFileData && (
        <ImagePreview
          file={selectedFileData}
          onClose={() => setSelectedFile(null)}
          onEdit={(text) => handleEdit(selectedFile!, text)}
          onReRecognize={() => handleReRecognize(selectedFile!)}
          onConfirm={() => handleConfirm(selectedFile!)}
        />
      )}
    </div>
  );
};

export default UploadPage;