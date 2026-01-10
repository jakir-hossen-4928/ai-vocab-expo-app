import type { Vocabulary } from '@/types';


// Use Google Translate API as requested
const DICTIONARY_API_URL = process.env.EXPO_PUBLIC_DICTIONARY_API;
const TRANSLATION_API_URL = process.env.EXPO_PUBLIC_GOOGLE_TRANSLATION_API;

export interface OnlineSearchResult extends Vocabulary {
    isOnlineResult: boolean;
}

/**
 * Fetch word definition and translation from free online APIs
 */
export const searchOnlineDictionary = async (word: string): Promise<OnlineSearchResult | null> => {
    try {
        if (!word || word.trim().length < 2) return null;

        const cleanWord = word.trim().toLowerCase();

        // Run both requests in parallel
        const [dictionaryRes, translationRes] = await Promise.allSettled([
            fetch(`${DICTIONARY_API_URL}/${cleanWord}`),
            fetch(`${TRANSLATION_API_URL}${encodeURIComponent(cleanWord)}`)
        ]);

        let definitionData: any = null;
        let translationData: any = null;

        // Process Dictionary Response
        if (dictionaryRes.status === 'fulfilled' && dictionaryRes.value.ok) {
            const data = await dictionaryRes.value.json();
            if (Array.isArray(data) && data.length > 0) {
                definitionData = data[0];
            }
        }

        // Process Translation Response (Google API)
        if (translationRes.status === 'fulfilled' && translationRes.value.ok) {
            translationData = await translationRes.value.json();
        }

        // Parse Google Translate Result
        // Format: [[["Bengali","English",...]], ...]
        const translatedText = translationData && translationData[0] && translationData[0][0] && translationData[0][0][0]
            ? translationData[0][0][0]
            : null;

        if (!definitionData && !translatedText) return null;

        // Construct Vocabulary object
        const english = definitionData?.word || cleanWord;
        const bangla = translatedText || 'Translation not found';

        // Extract meanings
        let partOfSpeech = 'unknown';
        let explanation = '';
        const examples: string[] = [];
        const synonyms: string[] = [];
        const antonyms: string[] = [];
        let pronunciation = '';

        if (definitionData) {
            if (definitionData.phonetic) {
                pronunciation = definitionData.phonetic;
            } else if (definitionData.phonetics?.length > 0) {
                pronunciation = definitionData.phonetics.find((p: any) => p.text)?.text || '';
            }

            if (definitionData.meanings?.length > 0) {
                const meaning = definitionData.meanings[0];
                partOfSpeech = meaning.partOfSpeech || 'unknown';

                if (meaning.definitions?.length > 0) {
                    explanation = meaning.definitions[0].definition;
                    if (meaning.definitions[0].example) {
                        examples.push(meaning.definitions[0].example);
                    }
                }

                // Collect synonyms/antonyms from all meanings
                definitionData.meanings.forEach((m: any) => {
                    if (m.synonyms) synonyms.push(...m.synonyms);
                    if (m.antonyms) antonyms.push(...m.antonyms);
                });
            }
        }

        return {
            id: `online_${cleanWord}`, // Deterministic ID based on word
            english,
            bangla,
            partOfSpeech,
            pronunciation,
            explanation,
            examples: examples.slice(0, 3).map(ex => ({ en: ex, bn: '' })), // Limit to 3 and map to object
            synonyms: synonyms.slice(0, 5), // Limit to 5
            antonyms: antonyms.slice(0, 5),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isOnlineResult: true,
            userId: 'online_user',
            origin: 'online',
            audioUrl: null,
            isFromAPI: false,
            isOnline: true,
            verbForms: [],
            relatedWords: []
        } as OnlineSearchResult;

    } catch (error) {
        console.error('Error searching online dictionary:', error);
        return null;
    }
};
