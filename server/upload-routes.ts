import express from 'express';

const router = express.Router();

// 임시 조치: 서버 크래시 방지를 위해 업로드 기능 일시 비활성화
// 추후 안정적인 로직으로 다시 구현 예정
router.post('/image', (req, res) => {
  res.status(503).json({ error: '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.' });
});

router.get('/:filename', (req, res) => {
  res.status(404).json({ error: 'Image not found' });
});

export default router;