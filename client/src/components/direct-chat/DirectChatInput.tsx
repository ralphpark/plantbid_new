import { useState, useRef, KeyboardEvent } from 'react';
import { Send, ImagePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DirectChatInputProps {
  onSend: (data: { content: string; messageType?: string; attachments?: any }) => void;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function DirectChatInput({
  onSend,
  isSending = false,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
}: DirectChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  console.log('[DirectChatInput] 렌더링 - disabled:', disabled, 'isSending:', isSending);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachedImages.length === 0) return;

    const messageType = attachedImages.length > 0 ? 'image' : 'text';
    const attachments = attachedImages.length > 0 ? { imageUrls: attachedImages } : undefined;

    onSend({
      content: trimmedMessage || '이미지를 보냈습니다.',
      messageType,
      attachments,
    });

    setMessage('');
    setAttachedImages([]);

    // 포커스 유지
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 조합 중에는 Enter 무시 (한글, 일본어, 중국어 입력 시)
    if (e.nativeEvent.isComposing) return;

    // Enter로 전송 (Shift+Enter는 줄바꿈)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 최대 3장 제한
    if (attachedImages.length + files.length > 3) {
      toast({
        title: '이미지는 최대 3장까지 첨부할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 파일 크기 체크 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('파일 크기는 5MB 이하여야 합니다.');
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) throw new Error('업로드 실패');

        const data = await res.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setAttachedImages((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      toast({
        title: '이미지 업로드 실패',
        description: error instanceof Error ? error.message : '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t bg-white p-3 relative z-20 flex-shrink-0">
      {/* 첨부된 이미지 미리보기 */}
      {attachedImages.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {attachedImages.map((url, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img
                src={url}
                alt={`첨부 ${index + 1}`}
                className="w-16 h-16 object-cover rounded-lg border"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex items-end gap-2">
        {/* 이미지 첨부 버튼 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || attachedImages.length >= 3}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <ImagePlus className="w-5 h-5 text-gray-500" />
          )}
        </Button>

        {/* 텍스트 입력 */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            console.log('[DirectChatInput] onChange:', e.target.value);
            setMessage(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => console.log('[DirectChatInput] 포커스됨')}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          className={cn(
            'flex-1 min-h-[40px] max-h-[120px] resize-none py-2',
            'focus:ring-1 focus:ring-primary',
            'relative z-20 bg-white text-gray-900'
          )}
        />

        {/* 전송 버튼 */}
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={handleSend}
          disabled={disabled || isSending || (!message.trim() && attachedImages.length === 0)}
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* 안내 텍스트 */}
      <p className="text-[10px] text-gray-400 mt-1 text-center">
        Enter로 전송, Shift+Enter로 줄바꿈
      </p>
    </div>
  );
}
