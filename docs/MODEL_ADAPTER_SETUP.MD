# Real Model Adapter Setup

Stories 25 and 26 add a configurable real-model path for `SKETCH` and `OBJECT_RENDER` generation.

## Adapter Modes

Worker adapter mode is controlled by environment variables:

- `SKETCH_ADAPTER_MODE`
- `OBJECT_RENDER_ADAPTER_MODE`

Accepted values:

- `auto` (default): use SD WebUI adapter if `A1111_BASE_URL` is set, otherwise fallback fake adapter.
- `real` / `sd_webui` / `true`: force SD WebUI adapter.
- any other value: use fake adapter.

## SD WebUI Requirement

Run an Automatic1111-compatible Stable Diffusion API server and set:

```bash
export A1111_BASE_URL="http://127.0.0.1:7860"
export SKETCH_ADAPTER_MODE="real"
export OBJECT_RENDER_ADAPTER_MODE="real"
```

The worker calls `POST /sdapi/v1/txt2img` and decodes the first returned image.

## Sketch Adapter Notes

- Generates a base image via SD WebUI.
- Converts to edge-enhanced monochrome wireframe output.
- Emits `WIRE` artifact subtype.

## Object Render Adapter Notes

- Generates a base image via SD WebUI.
- Produces RGBA output by deriving an alpha channel.
- Emits:
  - Primary `RENDER` artifact
  - Mask `RMASK` artifact

## Fallback Behavior

If real adapter prerequisites are not available, worker automatically uses fake adapters (unless explicitly forced to real mode).

This keeps local development and CI stable while enabling real model integration where available.
