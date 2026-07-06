from fastapi import APIRouter

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def meta() -> dict[str, list[dict[str, object]]]:
    return {
        "frameworks": [
            {"id": "vue", "name": "Vue", "versions": ["3.4"]},
        ]
    }
