from fastapi import APIRouter

from app.rag.corpus import SUPPORTED_VERSIONS

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def meta() -> dict[str, list[dict[str, object]]]:
    return {
        "frameworks": [
            {"id": "vue", "name": "Vue", "versions": list(SUPPORTED_VERSIONS)},
        ]
    }
