
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL?.split('@')[1]?.split('/')[0] ? `https://${process.env.SUPABASE_DB_URL?.split('@')[1]?.split('/')[0]}` : '';
// 환경변수에서 URL이 없으면 예외 처리가 필요할 수 있으나, 일단 기존 .env를 신뢰
// 주의: SUPABASE_URL과 SUPABASE_SERVICE_KEY가 .env에 있어야 합니다.
// 없는 경우 실행 시 에러가 나지 않도록 체크
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const BUCKET_NAME = 'uploads';

// 메모리 스토리지 사용 (Vercel 등 서버리스 환경 호환)
const storage = multer.memoryStorage();

// 파일 필터 설정 (이미지 파일만 허용)
const fileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
  }
};

// 업로드 설정
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  }
});

// 이미지 업로드 핸들러 (Supabase Storage 사용)
export async function uploadImage(req: Request, res: Response) {
  try {
    // 다중 파일 업로드 처리 (최대 5개)
    const uploadMultiple = upload.array('images', 5);

    uploadMultiple(req, res, async (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: '파일 크기는 5MB를 초과할 수 없습니다.' });
        }
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
      }

      try {
        // Supabase Storage에 업로드
        const uploadPromises = (req.files as Express.Multer.File[]).map(async (file) => {
          const fileExt = path.extname(file.originalname);
          const fileName = `${uuidv4()}${fileExt}`;
          const filePath = `${fileName}`;

          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false
            });

          if (error) {
            console.error(`Supabase upload error for ${file.originalname}:`, error);
            throw error;
          }

          // 공개 URL 생성
          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

          return {
            url: publicUrl,
            filename: fileName,
            mimetype: file.mimetype,
            size: file.size,
            originalName: file.originalname
          };
        });

        const fileInfos = await Promise.all(uploadPromises);

        // 성공 응답
        res.status(200).json({
          success: true,
          url: fileInfos[0]?.url || null, // 호환성 유지
          imageUrl: fileInfos[0]?.url || null, // 호환성 유지
          images: fileInfos,
          count: fileInfos.length
        });

      } catch (uploadError) {
        console.error('Supabase Storage 업로드 중 오류:', uploadError);
        return res.status(500).json({ error: '파일 스토리지 업로드 실패' });
      }
    });
  } catch (error) {
    console.error('이미지 업로드 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

// 이미지 조회 (Supabase로 이전되었으므로 호환성 유지만 하거나 제거)
// 클라이언트가 이제 publicUrl을 직접 사용하므로 이 API는 사실상 사용되지 않아야 함
export async function getUploadedImage(req: Request, res: Response) {
  // 이전 버전 호환성을 위해 남겨두지만, Supabase URL을 사용하는 경우 이 핸들러는 호출되지 않음
  // 만약 기존 로컬 이미지를 조회하려 한다면 404가 날 것임 (Vercel 환경 등)
  res.status(404).json({ error: '이미지는 이제 클라우드 스토리지에서 직접 제공됩니다.' });
}
