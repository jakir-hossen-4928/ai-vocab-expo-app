import { getOpenRouterApiKey } from './storage';
import { Vocabulary } from '@/types';

const BASE_URL = "https://openrouter.ai/api/v1";
const SITE_URL = "https://ai-vocabulary-coach.netlify.app";
const SITE_NAME = "AI Vocabulary App";

const getHeaders = (apiKey: string) => ({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": SITE_URL,
    "X-Title": SITE_NAME,
});

export const chatWithVocabulary = async (
    vocabulary: Vocabulary,
    messages: any[],
    apiKey?: string,
    modelId?: string
) => {
    const keyToUse = apiKey || await getOpenRouterApiKey();

    if (!keyToUse) {
        throw new Error("OpenRouter API key is required");
    }

    const systemPrompt = `
You are an expert English tutor.
Word: "${vocabulary.english}" (${vocabulary.partOfSpeech})
Meaning: ${vocabulary.bangla}

STRICT INSTRUCTIONS:
1. NO PREAMBLE. NO META-COMMENTARY. NO "Here is...", "I'll present...", "Okay...".
2. Start DIRECTLY with the answer.
3. If asked for synonyms, start directly with "1. ...".
4. If asked for meaning, start directly with the meaning.
5. KEEP IT BRIEF.
`;

    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
            role: m.role,
            content: m.content
        }))
    ];



    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: getHeaders(keyToUse),
            body: JSON.stringify({
                model: modelId || "google/gemma-2-9b-it:free",
                messages: apiMessages
            })
        });



        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[openRouterService] error data:', errorData);
            throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
        }

        const result = await response.json();
        const choice = result.choices[0];


        let content = choice.message.content;

        // Post-processing cleanup for known monologue patterns
        if (content) {
            // 1. Remove <think> tags (DeepSeek style)
            content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            // 2. Remove common conversational fillers at the start
            // Check first few lines for "I will", "Okay", etc.
            const lines = content.split('\n');
            if (lines.length > 0) {
                const firstLine = lines[0].trim();
                const fillerRegex = /^(Okay|Alright|So|I will|I'll|The user|Let me|Here (is|are)|Sure|Certainly|I'm|To answer)/i;

                // If first line is just filler or meta-commentary, remove it
                // We check if it matches the regex AND doesn't look like actual content (e.g. a list item "1. Okay")
                if (fillerRegex.test(firstLine) && !/^\d+\./.test(firstLine) && !/^-/.test(firstLine)) {
                    // Remove the first line/paragraph
                    content = lines.slice(1).join('\n').trim();
                }
            }
        }

        return {
            content: content,
            // OpenRouter often returns usage data
            usage: result.usage
        };
    } catch (error) {
        console.error('[openRouterService] fetch error:', error);
        throw error;
    }
};
