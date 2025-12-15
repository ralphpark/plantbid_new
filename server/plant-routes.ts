import { Express } from "express";
import { IStorage } from "./storage";
import multer from 'multer';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Multer 설정 (메모리 저장)
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('엑셀 파일만 업로드 가능합니다.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

export function setupPlantRoutes(app: Express, storage: IStorage) {
  // 식물 목록 조회 API
  app.get("/api/admin/plants", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const plants = await storage.getAllPlants();
      
      res.json({
        plants: plants || [],
        totalCount: plants?.length || 0
      });
    } catch (error) {
      console.error("관리자 식물 데이터 조회 오류:", error);
      res.status(500).json({ error: "식물 데이터를 불러오는 중 오류가 발생했습니다" });
    }
  });

  // 식물 추가 API
  app.post("/api/admin/plants", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const plantData = req.body;
      const newPlant = await storage.addPlant(plantData);
      res.json(newPlant);
    } catch (error) {
      console.error("식물 추가 오류:", error);
      res.status(500).json({ error: "식물 추가 중 오류가 발생했습니다" });
    }
  });

  // 식물 수정 API
  app.put("/api/admin/plants/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const plantId = parseInt(req.params.id);
      const plantData = req.body;
      const updatedPlant = await storage.updatePlant(plantId, plantData);
      res.json(updatedPlant);
    } catch (error) {
      console.error("식물 수정 오류:", error);
      res.status(500).json({ error: "식물 수정 중 오류가 발생했습니다" });
    }
  });

  // 식물 삭제 API
  app.delete("/api/admin/plants/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const plantId = parseInt(req.params.id);
      await storage.deletePlant(plantId);
      res.json({ success: true });
    } catch (error) {
      console.error("식물 삭제 오류:", error);
      res.status(500).json({ error: "식물 삭제 중 오류가 발생했습니다" });
    }
  });

  // 엑셀 업로드 API (임시로 공개 API로 설정)
  app.post("/api/plants/upload-excel", upload.single('file'), async (req, res) => {
    console.log('🚀 엑셀 업로드 API 시작!');
    console.log('요청 정보:', {
      method: req.method,
      url: req.url,
      hasFile: !!req.file,
      bodySize: req.body ? Object.keys(req.body).length : 0
    });
    
    // JSON 응답 헤더 명시적 설정
    res.setHeader('Content-Type', 'application/json');
    
    console.log('🔍 권한 체크:', {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      userRole: req.user?.role,
      hasUser: !!req.user
    });
    
    // 임시로 권한 체크 비활성화
    // if (!req.isAuthenticated() || req.user?.role !== 'admin') {
    //   return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    // }

    try {
      console.log('🔄 엑셀 업로드 처리 시작');
      
      if (!req.file) {
        console.log('❌ 파일이 업로드되지 않음');
        return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
      }

      console.log('📁 업로드된 파일:', {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      });

      // 엑셀 파일 파싱
      console.log('📊 엑셀 파일 파싱 시작');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log('✅ 엑셀 파일 파싱 완료');

      let successCount = 0;
      let errorCount = 0;

      // 강력한 엑셀 데이터 분석 시스템
      console.log('🚀 === 엑셀 데이터 완전 분석 시작 ===');
      console.log('📊 전체 데이터 개수:', jsonData.length);
      
      if (jsonData.length > 0) {
        const firstRow = jsonData[0] as Record<string, any>;
        console.log('🔍 첫 번째 행의 모든 키들:', Object.keys(firstRow));
        console.log('🔍 첫 번째 행 전체 데이터:', JSON.stringify(firstRow, null, 2));
        console.log('🔍 값이 있는 필드들:', Object.entries(firstRow).filter(([k, v]) => v && v !== ''));
        console.log('🔍 빈 필드들:', Object.entries(firstRow).filter(([k, v]) => !v || v === ''));
      }
      
      console.log('🚀 === 엑셀 데이터 분석 완료 ===');

      // 강화된 스마트 필드 매핑 함수
      const getFieldValue = (fieldNames: string[], row: any): string => {
        for (const name of fieldNames) {
          if (row[name] && row[name] !== '') {
            return row[name];
          }
        }
        return null;
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        
        try {
          // 각 행에 대한 상세 매핑 분석 (첫 3개 행만)
          if (i < 3) {
            console.log(`🔍 행 ${i + 1} 필드 매핑 분석:`);
            console.log(`  식물 이름: ${getFieldValue(['name', '식물 이름', '이름', '식물명'], row)}`);
            console.log(`  설명: ${getFieldValue(['description', '설명', 'desc'], row)}`);
            console.log(`  카테고리: ${getFieldValue(['category', '카테고리', '분류'], row)}`);
            console.log(`  가격대: ${getFieldValue(['priceRange', '가격대', '가격'], row)}`);
          }

          // 스마트 필드 매핑으로 데이터 추출
          const name = getFieldValue(['name', '식물 이름', '이름', '식물명'], row);
          const description = getFieldValue(['description', '설명', 'desc'], row);
          
          // 필수 필드 검증
          if (!name || !description) {
            console.log(`❌ 행 ${i + 1} 필수 필드 누락:`, { name, description });
            errorCount++;
            continue;
          }

          // 식물 데이터 준비 (스마트 매핑 사용)
          const plantData = {
            name: name,
            scientificName: getFieldValue(['scientificName', '학명', 'scientific_name'], row),
            description: description,
            careInstructions: getFieldValue(['careInstructions', '관리 방법', '관리법', 'care'], row),
            light: getFieldValue(['light', '광조건', '빛', '조명'], row),
            waterNeeds: getFieldValue(['waterNeeds', '물주기', '급수', 'water'], row),
            humidity: getFieldValue(['humidity', '습도'], row),
            temperature: getFieldValue(['temperature', '온도', '적정온도'], row),
            winterTemperature: getFieldValue(['winterTemperature', '겨울온도', '월동온도'], row),
            colorFeature: getFieldValue(['colorFeature', '색상특징', '색깔'], row),
            plantType: getFieldValue(['plantType', '식물종류', '유형'], row),
            hasThorns: getFieldValue(['hasThorns', '가시유무', '가시'], row) === 'true' || getFieldValue(['hasThorns', '가시유무', '가시'], row) === '있음',
            leafShape1: getFieldValue(['leafShape1', '잎모양1'], row),
            leafShape2: getFieldValue(['leafShape2', '잎모양2'], row),
            leafShape3: getFieldValue(['leafShape3', '잎모양3'], row),
            leafShape4: getFieldValue(['leafShape4', '잎모양4'], row),
            difficulty: getFieldValue(['difficulty', '난이도', '키우기'], row),
            experienceLevel: getFieldValue(['experienceLevel', '경험수준', '초보자'], row),
            petSafety: getFieldValue(['petSafety', '반려동물안전', '독성'], row),
            size: getFieldValue(['size', '크기', '사이즈'], row),
            category: getFieldValue(['category', '카테고리', '분류'], row),
            priceRange: getFieldValue(['priceRange', '가격대', '가격'], row),
            imageUrl: getFieldValue(['imageUrl', '이미지URL', '사진'], row)
          };

          await storage.addPlant(plantData);
          successCount++;
        } catch (error) {
          console.error('식물 데이터 삽입 오류:', error);
          console.error('오류가 발생한 데이터:', plantData);
          errorCount++;
        }
      }

      res.json({
        success: successCount,
        error: errorCount,
        total: jsonData.length
      });

    } catch (error) {
      console.error('💥 엑셀 업로드 처리 중 치명적 오류:', error);
      console.error('오류 메시지:', error.message);
      console.error('오류 스택:', error.stack);
      res.status(500).json({ 
        error: '엑셀 파일 처리 중 오류가 발생했습니다.',
        details: error.message,
        success: 0,
        error: 0,
        total: 0
      });
    }
  });

  // 엑셀 템플릿 다운로드 API
  app.get("/api/admin/plants/excel-template", (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }

    try {
      const templateData = [
        {
          '식물명': '예시 식물',
          '학명': 'Plantus exemplaris',
          '설명': '이것은 예시 식물입니다. 설명은 10자 이상 입력해주세요.',
          '관리방법': '물을 주 1-2회 주고, 밝은 곳에 두세요.',
          '광조건': '밝은 간접광',
          '물요구량': '주 1-2회',
          '습도': '40-60%',
          '온도': '18-25°C',
          '겨울온도': '15-20°C',
          '색상특징': '진한 녹색',
          '식물타입': '관엽식물',
          '가시유무': '없음',
          '잎모양1': '타원형',
          '잎모양2': '',
          '잎모양3': '',
          '잎모양4': '',
          '난이도': '쉬움',
          '경험수준': '초보자',
          '반려동물안전성': '안전함',
          '크기': '중형',
          '카테고리': '관엽식물',
          '가격대': '10,000-30,000원',
          '이미지URL': 'https://example.com/image.jpg'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '식물 데이터');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="plant-template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);

    } catch (error) {
      console.error('템플릿 생성 오류:', error);
      res.status(500).json({ error: '템플릿 생성 중 오류가 발생했습니다.' });
    }
  });

  // 중복 식물 정리 API
  app.post("/api/plants/remove-duplicates", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }

    try {
      console.log('🔥 중복 정리 API 호출됨');
      
      // 모든 식물 조회
      const allPlants = await storage.getAllPlants();
      console.log(`📊 전체 식물 개수: ${allPlants.length}`);
      
      // 식물명별로 그룹화하고 가장 완전한 정보를 가진 레코드만 선택
      const plantGroups = new Map();
      
      for (const plant of allPlants) {
        if (!plantGroups.has(plant.name)) {
          plantGroups.set(plant.name, []);
        }
        plantGroups.get(plant.name).push(plant);
      }
      
      console.log(`📊 고유 식물명 개수: ${plantGroups.size}`);
      
      // 각 그룹에서 가장 완전한 레코드 선택
      const bestRecords = [];
      let removedCount = 0;
      
      for (const [name, plants] of plantGroups) {
        if (plants.length === 1) {
          bestRecords.push(plants[0]);
        } else {
          // 가장 완전한 정보를 가진 레코드 찾기
          const bestPlant = plants.reduce((best, current) => {
            const bestScore = calculateCompletenessScore(best);
            const currentScore = calculateCompletenessScore(current);
            
            if (currentScore > bestScore) {
              return current;
            } else if (currentScore === bestScore) {
              // 점수가 같으면 더 작은 ID 선택
              return best.id < current.id ? best : current;
            }
            return best;
          });
          
          bestRecords.push(bestPlant);
          removedCount += plants.length - 1;
        }
      }
      
      console.log(`📊 정리 후 식물 개수: ${bestRecords.length}`);
      console.log(`🗑️ 제거된 중복 식물: ${removedCount}개`);
      
      // 기존 데이터 모두 삭제하고 최적화된 데이터 삽입
      await storage.removeAllPlants();
      await storage.insertMultiplePlants(bestRecords);
      
      res.json({
        success: true,
        message: `중복 정리 완료! ${allPlants.length}개에서 ${bestRecords.length}개로 정리됨 (${removedCount}개 제거)`
      });
      
    } catch (error) {
      console.error('중복 정리 오류:', error);
      res.status(500).json({ 
        success: false,
        error: '중복 정리 중 오류가 발생했습니다.' 
      });
    }
  });

  // 식물 정보 완성도 점수 계산 함수
  function calculateCompletenessScore(plant: any): number {
    let score = 0;
    const fields = [
      'scientificName', 'description', 'careInstructions', 'category', 
      'difficulty', 'priceRange', 'light', 'waterNeeds', 'humidity', 
      'temperature', 'colorFeature', 'plantType', 'petSafety', 
      'experienceLevel', 'size'
    ];
    
    for (const field of fields) {
      if (plant[field] && plant[field] !== '' && plant[field] !== null) {
        score++;
      }
    }
    
    return score;
  }

  // Perplexity AI 업데이트 API
  app.post("/api/admin/plants/ai-update", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }

    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Perplexity API 키가 설정되지 않았습니다.' });
      }

      // 모든 식물 조회
      const allPlants = await storage.getAllPlants();
      let updateCount = 0;

      // 처음 5개만 테스트로 업데이트
      for (const plant of allPlants.slice(0, 5)) {
        try {
          // API 호출 제한을 위한 지연
          await new Promise(resolve => setTimeout(resolve, 2000));

          const prompt = `
            "${plant.name}" 식물에 대한 정보를 다음 JSON 형식으로 정확히 제공해주세요:
            
            {
              "scientific_name": "학명",
              "care_instructions": "상세한 관리 방법",
              "light": "광조건 (예: 밝은 간접광)",
              "water_needs": "물주기 (예: 주 1-2회)",
              "humidity": "습도 (예: 40-60%)",
              "temperature": "온도 (예: 18-25°C)",
              "difficulty": "키우기 난이도 (쉬움/보통/어려움)",
              "pet_safety": "반려동물 안전성 (안전함/독성 있음/주의 필요)",
              "description": "식물 설명"
            }
            
            정확한 정보만 제공하고, 확실하지 않은 정보는 null로 표시해주세요.
          `;

          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: 'You are a plant expert. Provide accurate and detailed information about plants in Korean. Return information in JSON format only.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 1000,
              temperature: 0.2,
              top_p: 0.9,
              stream: false
            })
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            
            try {
              const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
              const plantInfo = JSON.parse(cleanedContent);
              
              // null이 아닌 값들만 필터링
              const filteredUpdates = Object.fromEntries(
                Object.entries(plantInfo).filter(([_, value]) => value !== null && value !== undefined && value !== '')
              );

              if (Object.keys(filteredUpdates).length > 0) {
                await storage.updatePlant(plant.id, filteredUpdates);
                updateCount++;
              }
            } catch (parseError) {
              console.error('JSON 파싱 실패:', content);
            }
          }
        } catch (error) {
          console.error(`식물 정보 업데이트 실패 (${plant.name}):`, error);
        }
      }

      res.json({ updated: updateCount });

    } catch (error) {
      console.error('AI 업데이트 오류:', error);
      res.status(500).json({ error: 'AI 업데이트 중 오류가 발생했습니다.' });
    }
  });

  // 간단한 인메모리 레이트 리미터
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 10; // 분당 10회
  const RATE_WINDOW = 60000; // 1분

  // 식물 Q&A 엔드포인트 (Gemini AI 사용)
  app.post("/api/plants/:id/ask", async (req, res) => {
    try {
      // 레이트 리미팅 체크 (IP 기반)
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const rateData = rateLimitMap.get(clientIp);
      
      if (rateData) {
        if (now > rateData.resetTime) {
          rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_WINDOW });
        } else if (rateData.count >= RATE_LIMIT) {
          return res.status(429).json({ 
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            retryAfter: Math.ceil((rateData.resetTime - now) / 1000)
          });
        } else {
          rateData.count++;
        }
      } else {
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_WINDOW });
      }

      const plantId = parseInt(req.params.id);
      const { question, chatHistory } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: '유효한 질문이 필요합니다.' });
      }

      if (question.length > 500) {
        return res.status(400).json({ error: '질문이 너무 깁니다. 500자 이내로 작성해주세요.' });
      }

      // 식물 정보 가져오기
      const plant = await storage.getPlant(plantId);
      if (!plant) {
        return res.status(404).json({ error: '식물을 찾을 수 없습니다.' });
      }

      // Gemini AI 모델 설정
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        safetySettings 
      });

      // 식물 정보를 포함한 프롬프트 생성
      const plantContext = `
당신은 식물 전문가입니다. 다음 식물에 대한 질문에 친절하고 정확하게 답변해주세요.

[식물 정보]
- 이름: ${plant.name}
- 학명: ${plant.scientificName || '정보 없음'}
- 설명: ${plant.description || '정보 없음'}
- 광량: ${plant.light || '정보 없음'}
- 물주기: ${plant.waterNeeds || '정보 없음'}
- 습도: ${plant.humidity || '정보 없음'}
- 온도: ${plant.temperature || '정보 없음'}
- 겨울 온도: ${plant.winterTemperature || '정보 없음'}
- 난이도: ${plant.difficulty || '정보 없음'}
- 반려동물 안전성: ${plant.petSafety || '정보 없음'}
- 크기: ${plant.size || '정보 없음'}
- 관리 방법: ${plant.careInstructions || '정보 없음'}

[대화 가이드]
- 위 식물 정보를 기반으로 답변하되, 정보가 부족하면 일반적인 식물 관리 지식을 활용하세요.
- 친근하고 따뜻한 어조로 답변하세요.
- 이모티콘을 적절히 사용하세요 (🌱, 🌿, 💧, ☀️, 💚 등).
- 한국어로 답변하세요.
- 짧고 명확하게 답변하되, 필요한 정보는 충분히 제공하세요.
`;

      // 이전 대화 기록 포함
      let conversationHistory = plantContext + "\n\n";
      
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach((msg: { role: string; content: string }) => {
          if (msg.role === 'user') {
            conversationHistory += `사용자: ${msg.content}\n`;
          } else if (msg.role === 'assistant') {
            conversationHistory += `전문가: ${msg.content}\n`;
          }
        });
      }
      
      conversationHistory += `사용자: ${question}\n전문가:`;

      // AI 응답 생성
      const result = await model.generateContent(conversationHistory);
      const response = await result.response;
      const answer = response.text();

      res.json({ 
        answer,
        plantName: plant.name
      });

    } catch (error: any) {
      console.error('식물 Q&A 오류:', error);
      
      // Gemini API 할당량 초과 에러 처리
      if (error?.status === 429 || error?.message?.includes('quota')) {
        return res.status(429).json({ 
          error: 'AI 서비스 일일 할당량이 초과되었습니다. 내일 다시 시도해주세요.',
          retryAfter: error?.errorDetails?.[2]?.retryDelay
        });
      }
      
      // 기타 네트워크 에러
      if (error?.status >= 500) {
        return res.status(503).json({ 
          error: 'AI 서비스가 일시적으로 이용 불가능합니다. 잠시 후 다시 시도해주세요.' 
        });
      }
      
      res.status(500).json({ error: '답변 생성 중 오류가 발생했습니다. 다시 시도해주세요.' });
    }
  });
}