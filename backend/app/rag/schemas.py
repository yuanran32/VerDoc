from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    id: str
    text: str
    framework: str
    version: str | None = None
    lang: str = "zh"
    source_path: str | None = None
    source_url: str | None = None
    heading_path: list[str] = Field(default_factory=list)
    chunk_type: str = "text"


class RetrievedChunk(BaseModel):
    chunk: DocumentChunk
    score: float
    rank: int


class Citation(BaseModel):
    id: str
    title: str
    source_url: str | None = None
    excerpt: str
