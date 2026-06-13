import json
from app.agents.base import BaseAgent

SYSTEM_PROMPT = """You are a senior security engineer performing a code security audit.

Analyze the provided repository and identify security vulnerabilities. Be precise and evidence-based — only flag issues you can see in the code.

Respond ONLY with valid JSON matching this schema exactly:
{
  "summary": "<one sentence summary>",
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "file": "<file path or 'repo-wide'>",
      "line": <integer or null>,
      "issue": "<what the problem is>",
      "recommendation": "<how to fix it>"
    }
  ],
  "confidence": <0.0-1.0>,
  "flags": ["<key issue string>", ...]
}

Check for:
1. Hardcoded secrets (API keys, passwords, tokens, connection strings with credentials)
2. Missing .env.example when sensitive config is present
3. Non-HTTPS external HTTP calls
4. CORS wildcard (*) in production config
5. SQL string interpolation / injection patterns
6. Credentials or tokens committed to version control
7. Missing input validation at API boundaries
"""


class SecurityAgent(BaseAgent):
    name = "security"

    async def run(self, repo: dict, github_token: str | None = None) -> dict:
        file_summary = "\n".join(
            f"=== {path} ===\n{content}"
            for path, content in list(repo["file_contents"].items())[:20]
        )
        tree_list = "\n".join(repo["file_tree"][:100])

        user_msg = f"""Repository: {repo['owner']}/{repo['repo']}

File tree:
{tree_list}

File contents:
{file_summary}
"""

        raw = await self.call_llm(SYSTEM_PROMPT, user_msg, max_tokens=2048)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group()) if m else {
                "summary": raw[:200],
                "findings": [],
                "confidence": 0.5,
                "flags": ["parse-error"],
            }

        findings = data.get("findings", [])
        high_count = sum(1 for f in findings if f.get("severity") == "HIGH")
        confidence = float(data.get("confidence", 0.8))
        flags = data.get("flags", [])

        content = f"## Security Analysis\n\n{data.get('summary', '')}\n\n"
        if findings:
            content += f"**{len(findings)} finding(s)** ({high_count} HIGH)\n\n"
            for f in findings:
                sev = f.get("severity", "LOW")
                content += f"- **[{sev}]** `{f.get('file', '?')}`: {f.get('issue', '')}\n"
        else:
            content += "No critical security issues detected.\n"

        msg_id = await self.post_to_band(
            output_type="SECURITY",
            content=content,
            confidence=confidence,
            flags=flags,
        )

        return {
            "band_message_id": msg_id,
            "findings": findings,
            "summary": data.get("summary", ""),
            "confidence": confidence,
            "flags": flags,
        }
