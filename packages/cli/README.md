# Commerce CLI

The private `@niyantra/commerce-cli` package provides read-only `health`, `list`, and `get` commands for SDK exploration. It is not published; `npx @niyantra/commerce-cli` will work only after a maintainer reviews and publishes the package.

For local development, build the SDK and run `node packages/cli/bin/niyantra-commerce.mjs --help`. Set `NIYANTRA_BASE_URL` and one of `NIYANTRA_API_KEY` or `NIYANTRA_BEARER_TOKEN` for authenticated commands. Do not put credentials on the command line.
