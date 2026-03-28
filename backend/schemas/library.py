from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LibraryItemType = Literal["command", "workflow", "skill", "claude-md", "agent"]
LibraryItemSource = Literal["builtin", "user", "imported"]


class CommandArg(BaseModel):
    name: str
    description: str | None = None
    required: bool
    default_value: str | None = None


class CommandConfig(BaseModel):
    command: str
    args: list[CommandArg] = Field(default_factory=list)


class LibraryItemSummary(BaseModel):
    id: str
    name: str
    type: LibraryItemType
    source: LibraryItemSource
    description: str
    tags: list[str] = Field(default_factory=list)
    linked_command_stem: str | None = None
    has_structured_args: bool = False
    updated_at: str


class LibraryItem(LibraryItemSummary):
    content: str
    imported_from: str | None = None
    created_at: str
    config: CommandConfig | None = None
    agent_deps: list[str] = Field(default_factory=list)


class LibraryItemCreate(BaseModel):
    name: str
    type: LibraryItemType
    description: str
    content: str = Field(max_length=100_000)
    tags: list[str] = Field(default_factory=list)
    config: CommandConfig | None = None
    linked_command_stem: str | None = None
    agent_deps: list[str] = Field(default_factory=list)


class LibraryItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = Field(default=None, max_length=100_000)
    tags: list[str] | None = None
    config: CommandConfig | None = None
    linked_command_stem: str | None = None
    agent_deps: list[str] | None = None


class ScannedItem(BaseModel):
    name: str
    type: LibraryItemType
    source_path: str
    description: str
    content_preview: str
    already_in_library: bool
    existing_id: str | None = None


class ScanRequest(BaseModel):
    path: str


class ScanResponse(BaseModel):
    scan_root: str
    items: list[ScannedItem]


class ImportRequestItem(BaseModel):
    source_path: str
    overwrite: bool = False


class ImportRequest(BaseModel):
    scan_root: str
    items: list[ImportRequestItem]


class ImportResult(BaseModel):
    imported: int
    skipped: int
    overwritten: int
    errors: list[dict[str, str]] = Field(default_factory=list)


class CopyToProjectRequest(BaseModel):
    project_id: str
