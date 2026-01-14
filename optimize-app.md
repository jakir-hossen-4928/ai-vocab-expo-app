In an **Expo React Native** project, there are a few **reliable ways to find unused packages**. I’ll show them **from safest → most accurate**, and explain **what works best with Expo**.

---

## ✅ 1. Use `depcheck` (BEST starting point)

This is the most common and safe tool.

### Install

```bash
npx depcheck
```

or if you want it globally:

```bash
npm install -g depcheck
```

### Run

```bash
npx depcheck
```

### What it shows

- ❌ **Unused dependencies**
- ❌ **Unused devDependencies**
- ⚠️ **Missing dependencies**

### Example output

```
Unused dependencies
* lodash
* axios

Unused devDependencies
* jest
```

### ⚠️ Important for Expo

Expo auto-imports many things (like `expo-font`, `expo-splash-screen`), so **double-check before uninstalling**.

---

## ✅ 2. Check unused packages using Expo Doctor (Expo-aware)

Expo has its own validator.

```bash
npx expo-doctor
```

It detects:

- Unused Expo packages
- Version mismatches
- Native packages not compatible with Expo

This is **very important** before production builds.

---

## ✅ 3. Find unused imports in your code (VERY important)

Unused packages usually come from unused imports.

### ESLint method (recommended)

Install ESLint if not already:

```bash
npx expo install eslint
```

Install unused import plugin:

```bash
npm install -D eslint-plugin-unused-imports
```

Update `.eslintrc.js`:

```js
module.exports = {
  extends: ["expo"],
  plugins: ["unused-imports"],
  rules: {
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { vars: "all", varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
    ],
  },
};
```

Then run:

```bash
npx eslint .
```

If a package is **never imported**, it’s almost always safe to remove.

---

## ✅ 4. Find unused dependencies with `npm ls`

Shows what is actually used.

```bash
npm ls --depth=0
```

Compare this with:

```bash
cat package.json
```

If a package:

- Is in `dependencies`
- Is never imported in code
- Is not required by another package

👉 **It’s unused**

---

## ✅ 5. Safe uninstall process (VERY IMPORTANT)

Remove **one package at a time**:

```bash
npm uninstall package-name
```

Then:

```bash
npx expo start -c
```

If app runs → ✅ safe
If error → undo install

---

## 🚫 DO NOT remove these blindly in Expo

Even if they look unused:

- `expo`
- `react`
- `react-native`
- `expo-status-bar`
- `expo-splash-screen`
- `expo-font`
- `expo-asset`
- `expo-constants`
- `@expo/metro-runtime`

These are often auto-used by Expo.

---

## ✅ Recommended workflow (Best Practice)

```bash
1. npx depcheck
2. npx expo-doctor
3. Remove ONE package
4. npx expo start -c
5. Test app
```

---

## 🎯 If you want, I can:

- Analyze **your `package.json`**
- Tell you **exactly which packages are safe to remove**
- Optimize packages for **production build (EAS)**

Just paste your `package.json` here 👍
