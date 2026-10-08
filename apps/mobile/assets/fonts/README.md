# Complete Ionicons browser font

`Ionicons.woff2` is a lossless browser encoding of the complete Ionicons TTF
already installed by `@expo/vector-icons@15.1.1`. It is **not a glyph subset**:
all 1,361 glyphs and 1,358 mapped code points are retained. Icon names, shapes,
and horizontal metrics are unchanged. The native `Icon.tsx` continues using
Expo's original Ionicons component and TTF.

The source font is 389,724 bytes; the browser font is 162,552 bytes (58.3%
smaller). `Ionicons.source.json` records hashes, versions, and validation.
`LICENSE-Ionicons-package.txt` preserves the installed package's MIT notice.

`Icon.web.tsx` loads this asset through Expo Font with the same complete
Ionicons glyph map. `metro.config.js` adds `woff2` to Expo's default asset
extensions; it does not replace the default resolver or serializer. The
fixed-size decorative icon wrapper prevents a font load from changing the
space reserved for a control's icon.

## Regeneration

Use isolated build tooling, not application dependencies. The checked-in file
was produced with Python 3.12, fontTools 4.53.1, and Brotli 1.2.0:

```python
from fontTools.ttLib import TTFont

source = "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"
font = TTFont(source)
font.flavor = "woff2"
font.save("assets/fonts/Ionicons.woff2")
```

Run this from `apps/mobile` after installing the pinned tools in an isolated
environment. Before updating the asset, compare glyph order, the complete
character map, horizontal metrics, contour coordinates and flags, and
composite references against the source font. Refresh the provenance hashes
and preserve the applicable license. Export web with `--clear`, confirm only
the WOFF2 font is requested in the browser, and visually inspect icons across
all routes. No Python tool or Brotli runtime is required by the application.
