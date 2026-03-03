from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from io import BytesIO
from typing import Protocol
from urllib import error, request
from urllib.parse import urlparse

from apps.worker.fake_adapters import render_placeholder_png
from PIL import Image, ImageFilter, ImageOps


@dataclass(frozen=True)
class AdapterResult:
    png_bytes: bytes
    width: int
    height: int
    subtype: str
    adapter_name: str
    mask_png_bytes: bytes | None = None
    mask_subtype: str | None = None


class GenerationAdapter(Protocol):
    def render(
        self, *, scene_id: str, job_id: str, input_payload: dict[str, object]
    ) -> AdapterResult: ...


def _prompt_from_payload(payload: dict[str, object]) -> tuple[str, str]:
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        compiled = metadata.get("compiled_prompt")
        if isinstance(compiled, str) and compiled.strip():
            negative = metadata.get("compiled_negative_prompt")
            return compiled.strip(), (negative.strip() if isinstance(negative, str) else "")

    prompt = payload.get("prompt")
    negative = payload.get("negative_prompt")
    return (
        prompt.strip()
        if isinstance(prompt, str) and prompt.strip()
        else "high quality detailed subject",
        negative.strip() if isinstance(negative, str) else "",
    )


def _img_to_png_bytes(image: Image.Image) -> bytes:
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeSketchAdapter:
    def render(
        self, *, scene_id: str, job_id: str, input_payload: dict[str, object]
    ) -> AdapterResult:
        rendered = render_placeholder_png(job_type="SKETCH", scene_id=scene_id, job_id=job_id)
        return AdapterResult(
            png_bytes=rendered.png_bytes,
            width=rendered.width,
            height=rendered.height,
            subtype=rendered.subtype,
            adapter_name="fake_sketch_v1",
        )


class FakeObjectRenderAdapter:
    def render(
        self, *, scene_id: str, job_id: str, input_payload: dict[str, object]
    ) -> AdapterResult:
        rendered = render_placeholder_png(
            job_type="OBJECT_RENDER", scene_id=scene_id, job_id=job_id
        )
        return AdapterResult(
            png_bytes=rendered.png_bytes,
            width=rendered.width,
            height=rendered.height,
            subtype=rendered.subtype,
            adapter_name="fake_object_v1",
        )


class SdWebUiClient:
    def __init__(self, base_url: str) -> None:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("A1111_BASE_URL must be an absolute http(s) URL")
        self.base_url = base_url.rstrip("/")

    def txt2img(
        self,
        *,
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        steps: int,
        cfg_scale: float,
    ) -> Image.Image:
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "cfg_scale": cfg_scale,
            "sampler_name": "Euler a",
            "batch_size": 1,
            "n_iter": 1,
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url=f"{self.base_url}/sdapi/v1/txt2img",
            method="POST",
            data=data,
            headers={"Content-Type": "application/json"},
        )

        try:
            with request.urlopen(req, timeout=120) as response:  # nosec B310
                decoded = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8")
            raise RuntimeError(f"SD WebUI request failed ({exc.code}): {detail}") from exc

        images = decoded.get("images")
        if not isinstance(images, list) or not images:
            raise RuntimeError("SD WebUI did not return image outputs")

        encoded = images[0]
        if not isinstance(encoded, str) or not encoded:
            raise RuntimeError("SD WebUI output image payload invalid")

        encoded_payload = encoded.split(",", 1)[-1]
        image_bytes = base64.b64decode(encoded_payload)
        with Image.open(BytesIO(image_bytes)) as output:
            return output.convert("RGB")


class SdWebUiSketchAdapter:
    def __init__(self, client: SdWebUiClient) -> None:
        self.client = client

    def render(
        self, *, scene_id: str, job_id: str, input_payload: dict[str, object]
    ) -> AdapterResult:
        prompt, negative_prompt = _prompt_from_payload(input_payload)
        width = (
            int(input_payload.get("width", 512))
            if isinstance(input_payload.get("width"), int)
            else 512
        )
        height = (
            int(input_payload.get("height", 512))
            if isinstance(input_payload.get("height"), int)
            else 512
        )

        generated = self.client.txt2img(
            prompt=f"line art sketch, monochrome, {prompt}",
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=20,
            cfg_scale=6.0,
        )

        sketch = ImageOps.grayscale(generated).filter(ImageFilter.FIND_EDGES)
        enhanced = ImageOps.autocontrast(sketch)
        wire = ImageOps.colorize(enhanced, black="white", white="black").convert("RGBA")

        return AdapterResult(
            png_bytes=_img_to_png_bytes(wire),
            width=wire.width,
            height=wire.height,
            subtype="WIRE",
            adapter_name="sd_webui_sketch_v1",
        )


class SdWebUiObjectRenderAdapter:
    def __init__(self, client: SdWebUiClient) -> None:
        self.client = client

    def render(
        self, *, scene_id: str, job_id: str, input_payload: dict[str, object]
    ) -> AdapterResult:
        prompt, negative_prompt = _prompt_from_payload(input_payload)
        width = (
            int(input_payload.get("width", 512))
            if isinstance(input_payload.get("width"), int)
            else 512
        )
        height = (
            int(input_payload.get("height", 512))
            if isinstance(input_payload.get("height"), int)
            else 512
        )

        generated = self.client.txt2img(
            prompt=f"isolated subject, clean silhouette, {prompt}",
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=28,
            cfg_scale=7.0,
        )

        rgba = generated.convert("RGBA")
        luma = ImageOps.grayscale(rgba)
        alpha = luma.point(lambda value: 0 if value > 245 else 255)
        rgba.putalpha(alpha)

        mask = alpha.convert("L")

        return AdapterResult(
            png_bytes=_img_to_png_bytes(rgba),
            width=rgba.width,
            height=rgba.height,
            subtype="RENDER",
            adapter_name="sd_webui_object_v1",
            mask_png_bytes=_img_to_png_bytes(mask),
            mask_subtype="RMASK",
        )


def _real_model_enabled(env_value: str) -> bool:
    normalized = env_value.strip().lower()
    return normalized in {"real", "sd_webui", "true", "1", "yes"}


def _real_adapter_available() -> bool:
    return bool(os.getenv("A1111_BASE_URL"))


def _resolve_sketch_adapter() -> GenerationAdapter:
    mode = os.getenv("SKETCH_ADAPTER_MODE", "auto")
    if _real_model_enabled(mode) or (mode == "auto" and _real_adapter_available()):
        base_url = os.getenv("A1111_BASE_URL", "http://127.0.0.1:7860")
        return SdWebUiSketchAdapter(SdWebUiClient(base_url))
    return FakeSketchAdapter()


def _resolve_object_adapter() -> GenerationAdapter:
    mode = os.getenv("OBJECT_RENDER_ADAPTER_MODE", "auto")
    if _real_model_enabled(mode) or (mode == "auto" and _real_adapter_available()):
        base_url = os.getenv("A1111_BASE_URL", "http://127.0.0.1:7860")
        return SdWebUiObjectRenderAdapter(SdWebUiClient(base_url))
    return FakeObjectRenderAdapter()


def resolve_adapter(job_type: str) -> GenerationAdapter:
    if job_type == "SKETCH":
        return _resolve_sketch_adapter()
    if job_type == "OBJECT_RENDER":
        return _resolve_object_adapter()
    raise ValueError(f"No adapter configured for job type '{job_type}'")
