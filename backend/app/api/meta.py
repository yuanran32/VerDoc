from fastapi import APIRouter

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def meta() -> dict[str, list[dict[str, object]]]:
    return {
        "frameworks": [
            {"id": "vue", "name": "Vue", "versions": ["3.4", "3.3", "3.2"]},
            {"id": "vite", "name": "Vite", "versions": ["5"]},
            {"id": "pinia", "name": "Pinia", "versions": ["2"]},
            {"id": "vue-router", "name": "Vue Router", "versions": ["4"]},
        ]
    }
