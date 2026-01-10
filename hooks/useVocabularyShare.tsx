import { ShareableVocabularyCard } from '@/components/ShareableVocabularyCard';
import { Vocabulary } from '@/types';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const useVocabularyShare = (colors: any) => {
    const viewRef = useRef(null);
    const [itemToShare, setItemToShare] = useState<Vocabulary | null>(null);

    const shareVocabularyImage = async (item: Vocabulary) => {
        setItemToShare(item);
        // Wait for render
        setTimeout(async () => {
            try {
                if (viewRef.current) {
                    const uri = await captureRef(viewRef, {
                        format: 'png',
                        quality: 1,
                        result: 'tmpfile',
                    });

                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(uri, {
                            mimeType: 'image/png',
                            dialogTitle: `Share Vocabulary: ${item.english}`,
                            UTI: 'public.png'
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to share image", e);
            } finally {
                setItemToShare(null);
            }
        }, 150); // Small delay to ensure render is complete
    };

    const ShareHiddenView = () => {
        if (!itemToShare) return null;
        return (
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 10000, // Move far right (off-screen)
                    zIndex: -1,
                    opacity: 1, // Keep opacity 1 so it renders fully for capture
                }}
            >
                <View
                    ref={viewRef}
                    collapsable={false}
                    style={{
                        backgroundColor: colors.background,
                        width: 400, // Updated width
                    }}
                >
                    <ShareableVocabularyCard item={itemToShare} colors={colors} />
                </View>
            </View>
        );
    };

    return { shareVocabularyImage, ShareHiddenView };
};
