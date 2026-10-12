# CopperPilot

**An open-source circuit workbench. Describe an idea, inspect every connection, and keep your design in open formats.**

CopperPilot v0.1 is built around the actual [tscircuit](https://github.com/tscircuit/tscircuit) circuit compiler. This is original software, not a copy of Flux.

## What works

- Four editable starter circuits: I²C pull-up board, LED indicator, voltage divider, and RC low-pass filter.
- Add resistors, capacitors, LEDs, diodes, headers, and generic ICs.
- Edit values, footprints, PCB positions, schematic positions and rotation; add or remove pin connections.
- Real schematic and two-layer PCB rendering, local autorouting, and visible design diagnostics.
- Undo / redo and automatic project saving in the current browser.
- Import/export project JSON, export tscircuit TSX source, BOM CSV, Circuit JSON, schematic/PCB SVGs, and Gerber/Excellon files in a ZIP.
- Generated SVGs are sanitized with DOMPurify; compilation runs in a dedicated web worker with a timeout.
- Optional AI generation through a server-side OpenAI or OpenAI-compatible model endpoint. Drafts are schema-checked, structurally checked, and require Apply before changing a project.
- Copy a structured design prompt for another AI and import its returned JSON without connecting a paid API.
- Responsive layout with separate Build, Design, Inspect and Projects views on mobile.

## Current state — read before use

The editor and four starter circuits work without an AI account. **Live AI requires configuration and is not enabled in the initial deployment.** There is no fake chat response or simulated AI generation.

This version is an early electronics prototyping tool. Generic component footprints and pin labels must be matched to real parts. Structural/routing checks are not electrical simulation or hardware certification. Descriptions and calculations are design intent and may become stale after manual edits. Gerbers are omitted from exports if errors are present or there are no routed traces. Review warnings and exact component ratings before fabrication.

Not included yet: a SPICE simulation workflow, live distributor pricing, 3D viewer, native KiCad/Altium import, production DFM verification, arbitrary component-library imports, cloud project sync, or collaborative editing. Back up project JSON before changing browsers or clearing site data.

## Run locally

Use Node.js 24 and the pinned pnpm version recorded in package.json.

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm dev
```

The portable development server uses http://localhost:5173. A clean Git clone automatically uses the portable profile; checkout-local settings are ignored by Git.

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Enable AI

Copy the keys in `.env.example` into an untracked `.dev.vars` file for local development. Set:

```dotenv
OPENAI_API_KEY=your-own-key
AI_MODEL=gpt-4.1-mini
COPPERPILOT_ALLOW_LOCAL_AI=true
```

The local-only flag allows development requests without hosted identity headers. Do not set it on an exposed deployment. A ChatGPT subscription does not configure an API account or key for this app. Provider charges depend on your account.

For an open-source model served by Ollama, configure an OpenAI-compatible endpoint instead:

```dotenv
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=qwen2.5-coder:14b
COPPERPILOT_ALLOW_LOCAL_AI=true
```

The model must already be installed in your own Ollama instance. Local model integration is implemented but not live-tested against a running Ollama server. Model capabilities differ; invalid output is rejected. A remotely hosted app cannot reach your PC's localhost; use local deployment for local models. Never paste API keys into source files, prompts, screenshots or issues.

Hosted Sites receive secrets through their environment settings. Preserve private access. AI requests require authenticated identity, reject foreign Origin values, and use a fixed server-configured provider endpoint. Changing the audience or using another host requires reviewing authentication and usage controls first.

## Run online with GitHub Pages

Repository: https://github.com/Vergota1417/copperpilot

A dedicated browser build is included. It supports the editor, starter circuits,
schematics, PCB routing, local project saving, JSON import, and all design exports.
The Pages edition makes no AI API requests and contains no API key. Use **Copy
prompt for my AI**, then import the returned circuit JSON, for an external-AI workflow.
The server-backed edition and its optional AI configuration remain available.

### First deployment — entirely in your browser

1. Open the repository's **Settings** tab.
2. Select **Pages** in the left sidebar.
3. Under **Build and deployment**, change **Source** to **GitHub Actions**.
4. Open the repository's **Actions** tab.
5. Choose **Deploy CopperPilot to GitHub Pages** in the left sidebar.
6. Click **Run workflow**, leave the branch as **main**, and confirm **Run workflow**.
7. Open the new run. Wait until both **build** and **deploy** show green check marks.
8. Click the published URL shown under **deploy**. You can also find it under
   **Settings > Pages > Visit site**.

GitHub Pages is not enabled merely by uploading source. A successful deployment
run is the confirmation that the browser app has been published. The intended
project path is `/copperpilot/`; all assets and the compiler worker are built for
that path. Deployment is manual: rerun this workflow after updates you want to publish.
Ordinary pushes run the validation workflow without deploying the website.

### First browser check

- Choose **New project > LED indicator** and wait for compilation.
- Switch between **Schematic** and **PCB** and confirm the circuit is visible.
- Select **R1** in **Parts** and change its value in **Inspector**.
- Refresh the page and confirm the value was saved in the same browser.
- Choose **Export > Project backup**, then import that JSON through **My projects**.
- Choose **Export > Complete design bundle** and inspect the downloaded files.

The Pages site and the earlier hosted site save projects separately because they
have different web addresses. Export and import JSON to move projects between them.
Full browser interaction testing remains to be performed after publication.

### Build the Pages files locally

```sh
pnpm build:pages
pnpm check:pages
```

The build writes `dist-pages/`. The check verifies the deployed asset paths and
runs the actual production compiler bundle with Web Worker globals and no network
access. It is a compiler/build check, not a browser UI test.

The original `pnpm dev` and `pnpm build` commands still use the server-backed edition.

## Architecture

| Location | Responsibility |
| --- | --- |
| `components/workbench.tsx` | Editor, inspector, local project storage and exports |
| `lib/design.ts` | Strict schema, structural checks, BOM and TSX export |
| `lib/templates.ts` | Editable low-voltage starter circuits |
| `lib/engine.ts` | tscircuit compilation, SVG generation, Gerbers |
| `lib/circuit.worker.ts` | Isolated, cancellable compiler worker |
| `lib/ai.ts` | Provider requests and AI result validation |
| `app/api/ai/route.ts` | Server-only AI configuration and endpoint |
| `tests/copperpilot.test.ts` | Circuit and validation regression tests |

Dependencies are pinned and locked. `@tscircuit/core` is pinned to 0.0.1900 and the main autorouter to 0.0.900 to avoid later releases with an unpublished Git dependency. The fanout solver retains its declared 0.0.718 autorouter dependency for type compatibility. The schematic trace solver is explicit because the core package imports it without declaring it. Do not update these in isolation without rerunning the circuit tests.

## Validation performed

All four starter circuits were compiled with real tscircuit code and checked for routed traces, schematic objects, Gerber copper/outline data, drill files, and absence of engine errors. Generated circuit diagrams were inspected separately from the app. Tests cover invalid formats, missing pins, duplicate connections, CSV escaping, project round-trip data, SI units and AI response handling. A production build and TypeScript check are required before release.

Full browser/mobile interaction testing was unavailable in the authoring environment. Live provider generation was not tested because no AI credentials or local model server were connected. These remain explicit verification limits.

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
