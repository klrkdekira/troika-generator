# Troika! Character Generator

A static, browser-based character generator using live data from [Troika! System JSON](https://cheeleong.dev/troika-system-json/). Game data and the character schema are fetched at runtime; no game-data snapshot is kept in this repository.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm build` writes the deployable static site to `docs/`, configured for GitHub Pages at `/troika-generator/`.

## Attribution and licensing

Troika! Character Generator is an independent production by Chee Leong and is not affiliated with the Melsonian Arts Council.

Data from Troika! System JSON by Chee Leong (MIT), based on the [Troika! SRD](https://troika-srd.netlify.app/). *Troika!* is a trademark of the Melsonian Arts Council. Source code is available under the MIT license in [LICENSE](LICENSE).
