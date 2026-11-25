import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY server muhitida sozlanmagan.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'TruckParts AI Uz — Buxoro' });
  });

  app.post('/api/analyze-part', async (req, res) => {
    try {
      const { imageBase64, mimeType, catalogSummary } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        catalogSummary?: Array<{
          artikul: string;
          nomi: string;
          jargon: string;
          model: string;
          holati: string;
        }>;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Rasm maʼlumoti yuborilmadi.' });
        return;
      }

      const allowedMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/jpeg';

      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const ai = getGeminiClient();

      const catalogText = Array.isArray(catalogSummary)
        ? catalogSummary
            .slice(0, 60)
            .map(
              (c) =>
                `- Artikul: ${c.artikul} | Nomi: ${c.nomi} | Jargon: ${c.jargon} | Model: ${c.model} | Holat: ${c.holati}`
            )
            .join('\n')
        : '';

      const systemPrompt = `Siz O'zbekiston (Buxoro M-37 / E-40 trassasi) og'ir yuk mashinalari (Howo, Shacman, Volvo, MAN, DAF, Scania, Schmitz, Krone, BPW, SAF) ehtiyot qismlari bo'yicha tajribali usta-diagnostsiz.
Vazifangiz:
1. Foydalanuvchi yuborgan rasmda singan/eskirgan yuk mashina detali bormi YOKI avto tex-pasportdagi 17 xonali VIN kod bormi — aniqlang.
2. Detalning aniq o'zbekcha rasmiy nomi, taxminiy OEM/artikul raqami, mos keluvchi fura markalari va O'zbekiston ustalari jargoni (masalan: porosyonok, grusha, uskortelniy, bochka balon, svetodiod, vozduxan, nakladka, stupitsa, salyarka filtr, moy filtr, gabarit) bilan bog'lang.
3. Quyidagi Buxoro ombori katalogidan eng mos keluvchi artikullarni (matchedArtikuls) tanlang. Agar rasmdagi detal katalogda UMUMAN bo'lmasa (masalan turbina, starter, radiator, shatun va h.k.), matchedArtikuls bo'sh massiv [] bo'lsin — bu holda Toshkent importchi omboridan 12 soatda buyurtma beriladi.
4. Javobni faqat o'zbek tilida, aniq va tushunarli JSON formatda qaytaring.`;

      const userPrompt = `Rasmni tahlil qiling (yuk mashina ehtiyot qismi yoki tex-pasport VIN kodi).

Mavjud Buxoro ombori katalogi:
${catalogText}

Aniq diagnostika va mos artikullarni JSON ko'rinishida qaytaring.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: allowedMime,
                data: cleanBase64,
              },
            },
            { text: userPrompt },
          ],
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isVinCode: {
                type: Type.BOOLEAN,
                description:
                  'Rasmda tex-pasport yoki 17 xonali VIN kod boʻlsa true, detal boʻlsa false.',
              },
              vinCode: {
                type: Type.STRING,
                description: 'Aniqlangan 17 xonali VIN kod yoki boʻsh satr.',
              },
              partNameUz: {
                type: Type.STRING,
                description: 'Detalning oʻzbekcha aniq nomi yoki VIN boʻyicha mashina rusumi.',
              },
              oemCode: {
                type: Type.STRING,
                description: 'Taxminiy yoki rasmdan oʻqilgan OEM/artikul kodi.',
              },
              truckBrands: {
                type: Type.STRING,
                description: 'Mos keluvchi yuk mashina markalari (masalan: Howo A7, Shacman X3000).',
              },
              matchedSlang: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Oʻzbek usta jargoni soʻzlari (porosyonok, grusha, uskortelniy, bochka balon, svetodiod, vozduxan, nakladka, stupitsa va h.k.).',
              },
              confidence: {
                type: Type.INTEGER,
                description: 'Aniqlik foizi 0 dan 100 gacha.',
              },
              diagnosisUz: {
                type: Type.STRING,
                description:
                  'Usta uchun 2-3 jumlalik aniq oʻzbekcha tahlil va almashtirish boʻyicha maslahat.',
              },
              matchedArtikuls: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Katalogdan aniq mos kelgan Artikul kodlari roʻyxati. Topilmasa boʻsh massiv.',
              },
            },
            required: [
              'isVinCode',
              'vinCode',
              'partNameUz',
              'oemCode',
              'truckBrands',
              'matchedSlang',
              'confidence',
              'diagnosisUz',
              'matchedArtikuls',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI boʻsh javob qaytardi. Iltimos, qayta urinib koʻring.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({ result: parsed });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'AI tahlilida kutilmagan xatolik yuz berdi.';
      console.error('Gemini analyze-part error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TruckParts AI Uz — Buxoro running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
