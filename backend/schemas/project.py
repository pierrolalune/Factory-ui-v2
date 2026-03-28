from pydantic import BaseModel


class ProjectBase(BaseModel):
    name: str
    path: str
    description: str | None = None
