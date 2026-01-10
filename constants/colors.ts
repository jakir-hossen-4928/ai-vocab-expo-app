/**
 * Generates vibrant, saturated background colors with excellent contrast for white text.
 * Based on a seed string (e.g., resource ID) to ensure consistency.
 */
export const getResourceColors = (seed: string) => {
    // List of vibrant, saturated background colors (good contrast with white text)
    const backgroundColors = [
        '#1E88E5', // Vibrant Blue
        '#8E24AA', // Vibrant Purple
        '#43A047', // Vibrant Green
        '#FB8C00', // Vibrant Orange
        '#E91E63', // Vibrant Pink
        '#00ACC1', // Vibrant Cyan
        '#7CB342', // Vibrant Lime
        '#FDD835', // Vibrant Yellow
        '#F4511E', // Vibrant Deep Orange
        '#5E35B1', // Vibrant Deep Purple
        '#00897B', // Vibrant Teal
        '#C0CA33', // Vibrant Lime Green
        '#D81B60', // Vibrant Rose
        '#3949AB', // Vibrant Indigo
        '#6D4C41', // Vibrant Brown
    ];

    // List of primary colors for icons (slightly lighter for variety)
    const primaryColors = [
        '#42A5F5', // Light Blue
        '#AB47BC', // Light Purple
        '#66BB6A', // Light Green
        '#FFA726', // Light Orange
        '#EC407A', // Light Pink
        '#26C6DA', // Light Cyan
        '#9CCC65', // Light Lime
        '#FFEE58', // Light Yellow
        '#FF7043', // Light Deep Orange
        '#7E57C2', // Light Deep Purple
        '#26A69A', // Light Teal
        '#D4E157', // Light Lime Green
        '#F06292', // Light Rose
        '#5C6BC0', // Light Indigo
        '#8D6E63', // Light Brown
    ];

    // Simple hash function for consistent color selection based on seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % backgroundColors.length;

    return {
        background: backgroundColors[index],
        primary: primaryColors[index],
        text: '#FFFFFF', // White text for excellent contrast
    };
};
