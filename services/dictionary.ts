export interface Phonetic {
    text: string;
    audio?: string;
}

export interface Definition {
    definition: string;
    example?: string;
    synonyms: string[];
    antonyms: string[];
}

export interface Meaning {
    partOfSpeech: string;
    definitions: Definition[];
}

export interface DictionaryEntry {
    word: string;
    phonetic?: string;
    phonetics: Phonetic[];
    origin?: string;
    meanings: Meaning[];
}

export interface DictionaryAPIError {
    message: string;
    status?: number;
    type: 'NOT_FOUND' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'UNKNOWN';
}

// Get API URL from environment variable with fallback
const getDictionaryAPIUrl = (): string => {
    return process.env.EXPO_DICTIONARY_API || 'https://api.dictionaryapi.dev/api/v2/entries/en';
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Search for a word definition using the Dictionary API
 * Includes retry logic with exponential backoff
 *
 * @param word - The word to search for
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns DictionaryEntry or null if not found
 * @throws DictionaryAPIError for critical errors
 */
export const searchDictionaryAPI = async (
    word: string,
    maxRetries: number = 3
): Promise<DictionaryEntry | null> => {
    if (!word || !word.trim()) {
        console.warn('[Dictionary API] Empty word provided');
        return null;
    }

    const apiUrl = getDictionaryAPIUrl();
    const cleanWord = word.trim().toLowerCase();
    const url = `${apiUrl}${encodeURIComponent(cleanWord)}`;
    // Note: Dictionary API URL format is base/word. No extra slash needed if base ends with slash (it does in config), but double slash is usually handled by browser/fetch or normalized.
    // The provided config '.../en/' ends with slash. The code '.../word' adds another segment?
    // Wait, `${apiUrl}/${...}` if apiUrl has trailing slash // -> double slash.
    // I should clean it.

    // Better URL construction:
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const finalUrl = `${baseUrl}/${encodeURIComponent(cleanWord)}`;

    let lastError: DictionaryAPIError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {


            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(finalUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeoutId);

            // Handle different HTTP status codes
            if (response.status === 404) {

                return null;
            }

            if (response.status === 429) {
                lastError = {
                    message: 'Rate limit exceeded. Please try again later.',
                    status: 429,
                    type: 'RATE_LIMIT'
                };

                // Exponential backoff for rate limits
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.warn(`[Dictionary API] Rate limited, retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }
                throw lastError;
            }

            if (!response.ok) {
                lastError = {
                    message: `API request failed with status ${response.status}`,
                    status: response.status,
                    type: 'UNKNOWN'
                };

                if (attempt < maxRetries) {
                    const delay = Math.min(500 * Math.pow(2, attempt), 3000);
                    console.warn(`[Dictionary API] Request failed, retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }
                throw lastError;
            }

            // Parse response
            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                console.warn('[Dictionary API] Invalid response format');
                return null;
            }

            const entry = data[0] as DictionaryEntry;

            // Validate response structure
            if (!entry.word || !entry.meanings || entry.meanings.length === 0) {
                console.warn('[Dictionary API] Incomplete entry data');
                return null;
            }


            return entry;

        } catch (error: any) {
            // Handle abort/timeout
            if (error.name === 'AbortError') {
                lastError = {
                    message: 'Request timeout. Please check your connection.',
                    type: 'NETWORK_ERROR'
                };
            }
            // Handle network errors
            else if (error instanceof TypeError || error.message?.includes('fetch')) {
                lastError = {
                    message: 'Network error. Please check your internet connection.',
                    type: 'NETWORK_ERROR'
                };
            }
            // Handle DictionaryAPIError
            else if (error.type) {
                lastError = error;
            }
            // Unknown error
            else {
                lastError = {
                    message: error.message || 'An unexpected error occurred',
                    type: 'UNKNOWN'
                };
            }

            console.error(`[Dictionary API] Error on attempt ${attempt + 1}:`, lastError);

            // Retry on network errors
            if (lastError?.type === 'NETWORK_ERROR' && attempt < maxRetries) {
                const delay = Math.min(500 * Math.pow(2, attempt), 3000);

                await sleep(delay);
                continue;
            }

            // Don't retry on final attempt
            if (attempt === maxRetries) {
                break;
            }
        }
    }

    // All retries exhausted
    if (lastError) {
        console.error('[Dictionary API] All retry attempts failed:', lastError);
    }

    return null;
};

/**
 * Convert Dictionary API result to app's Vocabulary format
 * Extracts and structures all relevant information
 *
 * @param entry - Dictionary API entry
 * @param id - Unique ID for the vocabulary item
 * @returns Formatted vocabulary object
 */
export const convertDictionaryToVocabulary = (entry: DictionaryEntry, id: string) => {
    const firstMeaning = entry.meanings[0];
    const firstDefinition = firstMeaning?.definitions[0];

    // Collect all examples from all meanings
    const examples: { en: string; bn: string }[] = [];
    entry.meanings.forEach(meaning => {
        meaning.definitions.forEach(def => {
            if (def.example && examples.length < 5) { // Limit to 5 examples
                examples.push({
                    en: def.example,
                    bn: "" // No Bengali translation from API
                });
            }
        });
    });

    // Collect all unique synonyms
    const synonymsSet = new Set<string>();
    entry.meanings.forEach(meaning => {
        meaning.definitions.forEach(def => {
            def.synonyms.forEach(syn => synonymsSet.add(syn));
        });
    });
    const synonyms = Array.from(synonymsSet).slice(0, 8); // Limit to 8 synonyms

    // Collect all unique antonyms
    const antonymsSet = new Set<string>();
    entry.meanings.forEach(meaning => {
        meaning.definitions.forEach(def => {
            def.antonyms.forEach(ant => antonymsSet.add(ant));
        });
    });
    const antonyms = Array.from(antonymsSet).slice(0, 8); // Limit to 8 antonyms

    // Collect all definitions
    const allDefinitions: string[] = [];
    entry.meanings.forEach(meaning => {
        meaning.definitions.forEach(def => {
            if (allDefinitions.length < 3) { // Limit to 3 definitions
                allDefinitions.push(def.definition);
            }
        });
    });

    // Find audio URL (prefer UK or US pronunciation)
    const audioUrl = entry.phonetics.find(p =>
        p.audio && (p.audio.includes('-uk') || p.audio.includes('-us'))
    )?.audio || entry.phonetics.find(p => p.audio)?.audio;

    return {
        id,
        english: entry.word,
        bangla: firstDefinition?.definition || "", // Use first definition as meaning
        partOfSpeech: firstMeaning?.partOfSpeech || "unknown",
        pronunciation: entry.phonetic || entry.phonetics[0]?.text || "",
        explanation: allDefinitions.join(' • ') || firstDefinition?.definition || "",
        examples: examples.slice(0, 3), // Limit to 3 examples for display
        synonyms,
        antonyms,
        origin: entry.origin,
        audioUrl: audioUrl ? (audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl) : undefined,
        isFromAPI: true, // Flag to indicate this is from external API
        isOnline: true, // Additional flag for UI distinction
        userId: "online", // Special userId for online results
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
};
