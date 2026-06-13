import json
from app.agents.base import BaseAgent

SYSTEM_PROMPT = """You are a Socratic programming mentor. Your job is to ask questions, not give answers directly.

Rules:
1. For every anti-pattern the Architect detected: ask a Socratic question (never correct directly).
   Example: "You used a global SQLAlchemy session — what do you think happens when two requests hit this simultaneously?"
2. Corrections are ONLY for HIGH-severity security findings where a question would be irresponsible.
3. If your own analysis of the code contradicts the Architect's ADR: set debate=true and explain the disagreement.
4. Produce a Socratic score: count of questions vs corrections.

Respond ONLY with valid JSON:
{
  "feedback": [
    {"type": "question" | "correction", "text": "<text>"}
  ],
  "debate": false,
  "debate_claim": "<what the Architect said>",
  "debate_rebuttal": "<your counterargument>",
  "socratic_score": {"questions": <int>, "corrections": <int>},
  "confidence": <0.0-1.0>,
  "flags": ["<concern>", ...]
}

Produce at least 3 Socratic questions. The debate field should be true only when you genuinely disagree with the ADR.
"""


class MentorAgent(BaseAgent):
    name = "mentor"

    async def run(self, repo: dict, github_token: str | None = None) -> dict:
        band_context = await self.get_band_context()

        security_msg = next((m for m in band_context if m.get("agent_name") == "security"), {})
        architect_msg = next((m for m in band_context if m.get("agent_name") == "architect"), {})
        onboarding_msg = next((m for m in band_context if m.get("agent_name") == "onboarding"), {})

        arch_ref = architect_msg.get("_band_message_id", "")

        file_sample = "\n".join(
            f"=== {path} ===\n{content[:800]}"
            for path, content in list(repo["file_contents"].items())[:8]
        )

        user_msg = f"""Repository: {repo['owner']}/{repo['repo']}

Code sample:
{file_sample}

Architect ADR (Band message ID: {arch_ref}):
{architect_msg.get('content', 'Not available')}

Anti-patterns from Architect:
{json.dumps(architect_msg.get('anti_patterns', []))}

Security findings (HIGH severity only):
{json.dumps([f for f in security_msg.get('findings', []) if f.get('severity') == 'HIGH'])}
"""

        raw = await self.call_llm(SYSTEM_PROMPT, user_msg, max_tokens=3000)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group()) if m else {
                "feedback": [{"type": "question", "text": raw[:300]}],
                "debate": False,
                "debate_claim": "",
                "debate_rebuttal": "",
                "socratic_score": {"questions": 1, "corrections": 0},
                "confidence": 0.6,
                "flags": ["parse-error"],
            }

        confidence = float(data.get("confidence", 0.8))
        flags = data.get("flags", [])
        feedback = data.get("feedback", [])
        score = data.get("socratic_score", {"questions": 0, "corrections": 0})

        content_lines = [f"## Mentor Feedback\n"]
        for item in feedback:
            icon = "❓" if item["type"] == "question" else "⚠️"
            content_lines.append(f"{icon} {item['text']}\n")
        content_lines.append(
            f"\n**Socratic Score:** {score.get('questions', 0)} questions, "
            f"{score.get('corrections', 0)} corrections"
        )
        content = "\n".join(content_lines)

        msg_id = await self.post_to_band(
            output_type="FEEDBACK",
            content=content,
            confidence=confidence,
            flags=flags,
            references=[arch_ref] if arch_ref else [],
        )

        debate_msg_id: str | None = None
        if data.get("debate"):
            debate_content = (
                f"## DEBATE\n\n"
                f"**Architect claimed:** {data.get('debate_claim', '')}\n\n"
                f"**Mentor disagrees:** {data.get('debate_rebuttal', '')}"
            )
            debate_msg_id = await self.post_to_band(
                output_type="DEBATE",
                content=debate_content,
                confidence=confidence,
                flags=["debate"],
                references=[arch_ref] if arch_ref else [],
            )

        return {
            "band_message_id": msg_id,
            "debate_message_id": debate_msg_id,
            "feedback": feedback,
            "socratic_score": score,
            "debate": data.get("debate", False),
            "confidence": confidence,
            "flags": flags,
        }
