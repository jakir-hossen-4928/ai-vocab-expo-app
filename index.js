import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import 'react-native-get-random-values';

// The context should point to the app directory
// We use require.context to find all files in the app directory
const ctx = require.context('./app');

export default function App() {
    console.log('🏗️ MANUAL ENTRY LOADED');
    console.log('📂 Context keys:', ctx.keys());
    return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
