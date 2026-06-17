import json
from app.agents.base import BaseAgent, safe_parse_json

SYSTEM_PROMPT = """You are a senior software architect producing an Architectural Decision Record (ADR).

You have access to prior agent findings from the Band room. Reference the Security Agent's Band message ID when discussing security context.

Respond ONLY with valid JSON:
{
  "adr": "<full ADR in markdown>",
  "anti_patterns": ["<pattern 1>", "<pattern 2>"],
  "tech_stack": ["<tech 1>", ...],
  "confidence": <0.0-1.0>,
  "flags": ["<key concern>", ...]
}

The ADR markdown must include these sections:
## What Was Built
## Technology Choices
## Architectural Patterns
## Known Tradeoffs
## Anti-Patterns Detected
## Security Context
"""


class ArchitectAgent(BaseAgent):
    name = "architect"

    async def run(self, repo: dict, github_token: str | None = None) -> dict:
        band_context = await self.get_band_context()
        security_msg = next(
            (m for m in band_context if m.get("agent_name") == "security"), {}
        )
        security_ref = security_msg.get("_band_message_id", "")

        file_summary = "\n".join(
            f"=== {path} ===\n{content}"
            for path, content in list(repo["file_contents"].items())[:20]
        )
        tree_list = "\n".join(repo["file_tree"][:100])

        user_msg = f"""Repository: {repo['owner']}/{repo['repo']}

File tree:
{tree_list}

File contents (sample):
{file_summary}

Security Agent findings (Band message ID: {security_ref}):
{json.dumps(security_msg.get('findings', []), indent=2)}
Security summary: {security_msg.get('summary', 'N/A')}
"""

        raw = await self.call_llm(SYSTEM_PROMPT, user_msg, max_tokens=4096)

        data = safe_parse_json(raw)
        if data.get("_parse_error"):
            data = {"adr": raw, "anti_patterns": [], "tech_stack": [], "confidence": 0.6, "flags": ["parse-error"]}

        confidence = float(data.get("confidence", 0.8))
        flags = data.get("flags", [])
        adr_content = data.get("adr", "")

        msg_id = await self.post_to_band(
            output_type="ADR",
            content=adr_content,
            confidence=confidence,
            flags=flags,
            references=[security_ref] if security_ref else [],
        )

        return {
            "band_message_id": msg_id,
            "adr": adr_content,
            "anti_patterns": data.get("anti_patterns", []),
            "tech_stack": data.get("tech_stack", []),
            "confidence": confidence,
            "flags": flags,
            "security_reference": security_ref,
        }
