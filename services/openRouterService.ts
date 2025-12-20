import { Vocabulary } from '@/types';
import { getOpenRouterApiKey } from './storage';

const BASE_URL = "https://openrouter.ai/api/v1";
const SITE_URL = "https://ai-vocabulary-coach.netlify.app";
const SITE_NAME = "AI Vocabulary App";

/* =========================
   MODEL SAFETY
========================= */

const BLOCKED_MODEL_KEYWORDS = ["gemma", "deepseek", "r1"];

const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const getSafeModel = (modelId?: string) => {
    if (!modelId) return DEFAULT_MODEL;
    const lower = modelId.toLowerCase();
    return BLOCKED_MODEL_KEYWORDS.some(k => lower.includes(k))
        ? DEFAULT_MODEL
        : modelId;
};

/* =========================
   HEADERS
========================= */

const getHeaders = (apiKey: string) => ({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": SITE_URL,
    "X-Title": SITE_NAME,
});

/* =========================
   LANGUAGE DETECTION
========================= */

const wantsBangla = (messages: any[]) => {
    const last = messages[messages.length - 1]?.content || "";
    return /(বাংলা|বাংলায়|বাংলাতে|bangla)/i.test(last);
};

/* =========================
   RESPONSE CLEANUP
========================= */

const cleanResponse = (content: string): string => {
    if (!content) return "";

    return content
        // remove reasoning tags
        .replace(/<(think|reasoning)>[\s\S]*?<\/(think|reasoning)>/gi, '')
        // remove filler/thinking lines
        .replace(
            /^(okay|sure|certainly|the user|i think|let me|as an ai|thinking|got it|wait).*$/gim,
            ''
        )
        // remove broken unicode noise
        .replace(/[�]+/g, '')
        .trim();
};

/* =========================
   VOCABULARY ENFORCEMENT
========================= */

const enforceVocabularyUsage = (
    content: string,
    vocabulary: Vocabulary
): string => {
    if (!content) return "";
    if (!content.toLowerCase().includes(vocabulary.english.toLowerCase())) {
        return `${vocabulary.english}: ${content}`;
    }
    return content;
};

/* =========================
   MAIN FUNCTION
========================= */

export const chatWithVocabulary = async (
    vocabulary: Vocabulary,
    messages: any[],
    apiKey?: string,
    modelId?: string
) => {
    const keyToUse = apiKey || await getOpenRouterApiKey();
    if (!keyToUse) throw new Error("OpenRouter API key is required");

    const banglaRequested = wantsBangla(messages);

    const systemPrompt = `
You are an expert English vocabulary tutor.

TARGET WORD (DO NOT CHANGE):
Word: "${vocabulary.english}"
Part of speech: ${vocabulary.partOfSpeech}
Meaning (Bangla): ${vocabulary.bangla}

LANGUAGE RULES (VERY IMPORTANT):
- Default output language: ENGLISH ONLY.
- Use BANGLA ONLY if the user explicitly asks for Bangla.
- NEVER mix English and Bangla in the same sentence.
- Use clean, correct grammar only.
- NO corrupted, broken, or partial Bangla text.

CONTENT RULES:
- ALL answers must be ONLY about the TARGET WORD.
- ALWAYS include the exact word "${vocabulary.english}".
- NO analysis, reasoning, or internal thoughts.
- NO greetings or preamble.
- Start directly with the answer.
- Keep it brief and clear.
`;

    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: getHeaders(keyToUse),
        body: JSON.stringify({
            model: getSafeModel(modelId),
            messages: apiMessages,
            reasoning: { effort: "none" },
            temperature: 0.2,
            max_tokens: banglaRequested ? 200 : 160
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData?.error?.message || `OpenRouter API error: ${response.status}`
        );
    }

    const result = await response.json();
    const rawContent = result?.choices?.[0]?.message?.content || "";

    const cleaned = cleanResponse(rawContent);
    const finalContent = enforceVocabularyUsage(cleaned, vocabulary);

    return {
        content: finalContent,
        usage: result.usage
    };
};
