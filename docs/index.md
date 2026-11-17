---
title: isoform Documentation
description: One styling API for React and React Native
---

# isoform

One styling API for **React** and **React Native**. Write a component once, run it on web and mobile.

```bash
npm install isoform
```

```tsx
import { configure, engine } from 'isoform';

configure({ provider: 'auto', theme: { color: { primary: '#6366f1' } } });

export const Button = engine('Pressable', ({ theme }) => ({
  paddingInline: '1.25rem',
  borderRadius: 12,
  backgroundColor: theme.color.primary,
})).when('platform:web', { style: { cursor: 'pointer' } });
```

## Documentation

| Section | Description |
|---|---|
| [README](../README.md) | Overview, quick start, vocabulary and migration |
| [Guide](./README.md) | Architecture, adapters, atomic CSS, custom providers, troubleshooting |
| [`examples/showcase`](../examples/showcase) | The interactive showcase: one page per feature, used by both apps |
| [`example/`](../example) | Expo app running the showcase |
| [`example-web/`](../example-web) | Vite + React DOM app running the same showcase |
