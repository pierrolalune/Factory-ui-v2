"""Detect when Claude CLI pauses waiting for user input (permission prompts).

Watches PTY output for known confirmation patterns and emits state transitions.
"""

import re


class PromptDetector:
    """Stateful detector: tracks whether we were in awaiting_input state."""

    PATTERNS = [
        re.compile(r"\[y/n\]\s*$", re.MULTILINE),
        re.compile(r"\[Y/n\]\s*$", re.MULTILINE),
        re.compile(r"\[yes/no\]\s*$", re.MULTILINE),
        re.compile(r"Do you want to allow"),
        re.compile(r"Allow this action"),
        re.compile(r"Proceed\? \("),
    ]

    def __init__(self) -> None:
        self._was_awaiting = False

    def _matches_prompt(self, text: str) -> bool:
        """Return True if text contains a known permission/confirmation prompt."""
        return any(p.search(text) for p in self.PATTERNS)

    def feed(self, text: str) -> str | None:
        """Feed decoded PTY text. Returns state transition string or None.

        Returns:
            'awaiting_input' — run just entered awaiting state
            'active'         — run resumed after awaiting state
            None             — no state change
        """
        is_prompt = self._matches_prompt(text)

        if is_prompt and not self._was_awaiting:
            self._was_awaiting = True
            return "awaiting_input"

        if not is_prompt and self._was_awaiting:
            self._was_awaiting = False
            return "active"

        return None
