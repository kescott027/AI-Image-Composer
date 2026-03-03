from collections.abc import Generator

from sqlalchemy.orm import Session

from apps.api.db.session import get_session_local


def get_db_session() -> Generator[Session, None, None]:
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
