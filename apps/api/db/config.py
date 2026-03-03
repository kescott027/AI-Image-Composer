import os

POSTGRES_PORT = os.getenv("AIIC_POSTGRES_PORT", "55432")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg://postgres:postgres@localhost:{POSTGRES_PORT}/ai_image_composer",
)
