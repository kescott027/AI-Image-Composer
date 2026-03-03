from dataclasses import dataclass
from io import BytesIO

from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont


@dataclass(frozen=True)
class FakeRenderResult:
    png_bytes: bytes
    width: int
    height: int
    subtype: str


_STYLE_MAP = {
    "SKETCH": {
        "subtype": "WIRE",
        "background": (245, 245, 245, 255),
        "accent": (45, 45, 45, 255),
    },
    "OBJECT_RENDER": {
        "subtype": "RENDER",
        "background": (224, 240, 255, 255),
        "accent": (18, 76, 147, 255),
    },
    "FINAL_COMPOSITE": {
        "subtype": "COMPOSITE",
        "background": (227, 250, 234, 255),
        "accent": (30, 120, 56, 255),
    },
    "ZONE_RENDER": {
        "subtype": "COMPOSITE",
        "background": (236, 248, 255, 255),
        "accent": (30, 93, 138, 255),
    },
    "REFINE": {
        "subtype": "REFINED",
        "background": (249, 242, 232, 255),
        "accent": (149, 92, 32, 255),
    },
}


def render_placeholder_png(job_type: str, scene_id: str, job_id: str) -> FakeRenderResult:
    style = _STYLE_MAP.get(job_type)
    if style is None:
        raise ValueError(f"No fake adapter configured for job type '{job_type}'")

    width = 512
    height = 512
    image = Image.new("RGBA", (width, height), style["background"])
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    # Draw a border and cross lines to make artifacts visibly distinct.
    draw.rectangle((18, 18, width - 18, height - 18), outline=style["accent"], width=6)
    draw.line((24, 24, width - 24, height - 24), fill=style["accent"], width=3)
    draw.line((width - 24, 24, 24, height - 24), fill=style["accent"], width=3)

    text_lines = [
        "AI Image Composer",
        f"Fake {job_type}",
        f"scene: {scene_id}",
        f"job: {job_id}",
    ]

    y = 40
    for line in text_lines:
        draw.text((36, y), line, fill=style["accent"], font=font)
        y += 28

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return FakeRenderResult(
        png_bytes=buffer.getvalue(),
        width=width,
        height=height,
        subtype=style["subtype"],
    )
