import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const router = express.Router();

// Supabase 클라이언트 설정 (인라인)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
// DB URL에서 호스트만 추출해서 fallback URL 생성 시도 (예외 처리 포함)
const getFallbackUrl = () => {
  try {
    if (!process.env.SUPABASE_DB_URL) return '';
    const parts = process.env.SUPABASE_DB_URL.split('@');
    if (parts.length < 2) return '';
    const hostParts = parts[1].split('/');
    if (hostParts.length < 1) return '';
    return `https://${hostParts[0]}`;
  } catch (e) {
    return '';
  }
};
const supabaseUrl = process.env.SUPABASE_URL || getFallbackUrl();

let supabase: ReturnType<typeof createClient> | null = null;
const BUCKET_NAME = 'uploads';

// 초기화 시도
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase Storage Client 초기화 성공');
  } catch (error) {
    console.warn('Supabase Client 초기화 실패:', error);
  }
} else {
  console.warn('Supabase 환경 변수(SUPABASE_URL, SUPABASE_SERVICE_KEY)가 설정되지 않았습니다.');
}

// 메모리 스토리지 설정 (Vercel EROFS 방지)
const storage = multer.memoryStorage();

// 파일 필터
const fileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// 업로드 핸들러
router.post('/image', (req: Request, res: Response) => {
  upload.array('images', 5)(req, res, async (err: any) => {
    if (err) {
      console.error("[Upload Error]", err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '파일 크기는 5MB를 초과할 수 없습니다.' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      console.error("[Upload Error] No files provided");
      return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
    }

    try {
      if (!supabase) {
        throw new Error('Supabase client is not initialized. Check environment variables.');
      }

      const files = req.files as Express.Multer.File[];
      const uploadPromises = files.map(async (file) => {
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = `${fileName}`; // 버킷 루트에 저장

        const { data, error } = await supabase!.storage
          .from(BUCKET_NAME)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) {
          console.error(`Supabase upload error for ${file.originalname}:`, error);
          throw error;
        }

        const { data: { publicUrl } } = supabase!.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        return {
          url: publicUrl,
          filename: fileName,
          mimetype: file.mimetype,
          size: file.size
        };
      });

      const fileInfos = await Promise.all(uploadPromises);

      res.status(200).json({
        success: true,
        images: fileInfos,
        url: fileInfos[0]?.url // 호환성
      });

    } catch (error: any) {
      console.error('Supabase Storage 업로드 실패:', error);
      res.status(500).json({ error: '파일 업로드 중 서버 오류가 발생했습니다: ' + error.message });
    }
  });
});

// 호환성용 라우트
router.get('/:filename', (req, res) => {
  res.status(404).json({ error: 'Use direct Supabase URL' });
});

export default router;