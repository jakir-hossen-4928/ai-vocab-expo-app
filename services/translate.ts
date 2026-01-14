export interface TranslationResult {
    translatedText: string;
    originalText: string;
    sourceLanguage: string;
    targetLanguage: string;
}

const TRANSLATE_API_URL = process.env.EXPO_GOOGLE_TRANSLATION_API ||
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=';

/**
 * Detect if text is primarily Bangla or English
 * @param text - The text to analyze
 * @returns 'bn' for Bangla, 'en' for English
 */
export function detectLanguage(text: string): 'bn' | 'en' {
    // Check for Bangla Unicode range (U+0980 to U+09FF)
    const banglaRegex = /[\u0980-\u09FF]/;
    return banglaRegex.test(text) ? 'bn' : 'en';
}

/**
 * Translate text with automatic language detection
 * @param text - The text to translate
 * @param targetLang - Optional target language (auto-detected if not provided)
 * @returns Promise with translation result
 */
export async function translateTextAuto(text: string, targetLang?: 'en' | 'bn'): Promise<TranslationResult> {
    try {
        const sourceLang = detectLanguage(text);
        const target = targetLang || (sourceLang === 'en' ? 'bn' : 'en');
        
        // If source and target are the same, return original text
        if (sourceLang === target) {
            return {
                translatedText: text,
                originalText: text,
                sourceLanguage: sourceLang,
                targetLanguage: target
            };
        }

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }

        const data = await response.json();

        // Parse the response - Google Translate API returns an array
        // Format: [[[translated_text, original_text, null, null, 3]], null, "en"]
        let translatedText = '';

        if (data && Array.isArray(data) && data[0]) {
            // Concatenate all translated segments
            for (const segment of data[0]) {
                if (segment && segment[0]) {
                    translatedText += segment[0];
                }
            }
        }

        if (!translatedText) {
            throw new Error('No translation received');
        }

        return {
            translatedText: translatedText.trim(),
            originalText: text,
            sourceLanguage: sourceLang,
            targetLanguage: target
        };
    } catch (error) {
        console.error('[GoogleTranslate] Translation error:', error);
        throw new Error('Failed to translate text. Please try again.');
    }
}

/**
 * Translate text from English to Bangla using Google Translate API
 * @param text - The text to translate
 * @returns Promise with translation result
 */
export async function translateText(text: string): Promise<TranslationResult> {
    try {
        const url = `${TRANSLATE_API_URL}${encodeURIComponent(text)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }

        const data = await response.json();

        // Parse the response - Google Translate API returns an array
        // Format: [[[translated_text, original_text, null, null, 3]], null, "en"]
        let translatedText = '';

        if (data && Array.isArray(data) && data[0]) {
            // Concatenate all translated segments
            for (const segment of data[0]) {
                if (segment && segment[0]) {
                    translatedText += segment[0];
                }
            }
        }

        if (!translatedText) {
            throw new Error('No translation received');
        }

        return {
            translatedText: translatedText.trim(),
            originalText: text,
            sourceLanguage: 'en',
            targetLanguage: 'bn'
        };
    } catch (error) {
        console.error('[GoogleTranslate] Translation error:', error);
        throw new Error('Failed to translate text. Please try again.');
    }
}

/**
 * Translate multiple texts in batch
 * @param texts - Array of texts to translate
 * @returns Promise with array of translation results
 */
export async function translateBatch(texts: string[]): Promise<TranslationResult[]> {
    try {
        const promises = texts.map(text => translateText(text));
        return await Promise.all(promises);
    } catch (error) {
        console.error('[GoogleTranslate] Batch translation error:', error);
        throw new Error('Failed to translate texts. Please try again.');
    }
}

