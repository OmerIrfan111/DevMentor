import json
from app.agents.base import BaseAgent

SYSTEM_PROMPT = """You are a senior developer experience engineer producing onboarding documentation.

You have access to the Architect's ADR from the Band room. Reference its architecture choices in your CONTRIBUTING.md.

Respond ONLY with valid JSON:
{
  "contributing": "<full CONTRIBUTING.md in markdown>",
  "setup_walkthrough": "<numbered step-by-step setup guide in markdown>",
  "first_good_issues": [
    {
      "title": "<issue title>",
      "description": "<what to implement>",
      "acceptance_criteria": ["<criterion 1>", "<criterion 2>"],
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "confidence": <0.0-1.0>,
  "flags": ["<concern>", ...]
}

Produce exactly 3 first_good_issues. Each should reference an anti-pattern from the ADR where relevant.
The CONTRIBUTING.md must cover: project description, prerequisites, local setup, coding standards, PR process.
"""


class OnboardingAgent(BaseAgent):
    name = "onboarding"

    async def run(self, repo: dict, github_token: str | None = None) -> dict:
        band_context = await self.get_band_context()

        architect_msg = next(
            (m for m in band_context if m.get("agent_name") == "architect"), {}
        )
        security_msg = next(
            (m for m in band_context if m.get("agent_name") == "security"), {}
        )
        arch_ref = architect_msg.get("_band_message_id", "")

        user_msg = f"""Repository: {repo['owner']}/{repo['repo']}

File tree:
{chr(10).join(repo['file_tree'][:80])}

Architect ADR (Band message ID: {arch_ref}):
{architect_msg.get('content', 'Not available')}

Anti-patterns identified by Architect:
{json.dumps(architect_msg.get('anti_patterns', []))}

Security findings summary:
{security_msg.get('summary', 'N/A')}
"""

        raw = await self.call_llm(SYSTEM_PROMPT, user_msg, max_tokens=4096)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group()) if m else {
                "contributing": raw,
                "setup_walkthrough": "",
                "first_good_issues": [],
                "confidence": 0.6,
                "flags": ["parse-error"],
            }

        confidence = float(data.get("confidence", 0.8))
        flags = data.get("flags", [])
        contributing = data.get("contributing", "")

        msg_id = await self.post_to_band(
            output_type="CONTRIBUTING",
            content=contributing,
            confidence=confidence,
            flags=flags,
            references=[arch_ref] if arch_ref else [],
        )

        return {
            "band_message_id": msg_id,
            "contributing": contributing,
            "setup_walkthrough": data.get("setup_walkthrough", ""),
            "first_good_issues": data.get("first_good_issues", []),
            "confidence": confidence,
            "flags": flags,
        }
