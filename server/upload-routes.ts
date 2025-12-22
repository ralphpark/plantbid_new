import express from 'express';
import { uploadImage } from './uploads.js';

const router = express.Router();

// 이미지 업로드 (Supabase Storage 사용)
router.post('/image', uploadImage);

// 이미지 조회 (기존 로컬 파일 호환성용 - Vercel에서는 의미 없음)
// 이제 클라이언트가 Supabase URL을 직접 사용하므로 이 엔드포인트는 사용되지 않음
router.get('/:filename', (req, res) => {
  res.status(404).json({ error: '이미지는 클라우드 스토리지에서 직접 제공됩니다.' });
});

export default router;