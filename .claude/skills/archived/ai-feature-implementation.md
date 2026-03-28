# AI Feature Implementation

This skill provides patterns for building AI-powered features properly.

## Use this skill when

- A feature spec calls for AI integration (Claude API, LLM-powered features, smart assistants)
- Building tool-using agent patterns
- Integrating the Anthropic SDK

## Do not use this skill when

- The task has no AI/LLM component
- Writing standard application code

## Instructions

When a feature spec calls for AI integration, build it properly — not as a naive API call:

### Do

- Build a proper **tool-using agent** pattern: define tools the AI can call, a system prompt that describes its role, and conversation management (history, context window)
- Use the Anthropic SDK's structured tool use: tool definitions with JSON schemas, tool result handling, multi-turn conversations
- Handle streaming responses for real-time UX (typing indicators, progressive rendering)
- Implement proper error handling for AI-specific failures: malformed responses, refusals, empty outputs, hallucinated JSON, rate limits, timeouts

### Don't

- Don't make raw HTTP calls with string-concatenated prompts — use the SDK
- Don't treat the AI as a black box that always returns perfect output — validate and parse responses defensively
- Don't skip AI-specific edge case tests: what happens when the model returns empty? When it refuses? When it hallucinates invalid JSON? When the API times out?

This guidance exists because AI feature implementation patterns are recent enough that the model's training data covers them thinly. Explicit patterns produce dramatically better AI integrations.
