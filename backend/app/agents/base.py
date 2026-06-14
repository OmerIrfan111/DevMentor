import httpx
import re
from abc import ABC, abstractmethod
from anthropic import AsyncAnthropicBedrock
from app.band.client import BandClient
from app.config import settings


async def fetch_repo_contents(repo_url: str, github_token: str | None = None) -> dict:
    """Fetch file tree and key file contents from a GitHub repo."""
    match = re.search(r"github\.com/([^/]+)/([^/\s?#]+)", repo_url)
    if not match:
        raise ValueError(f"Cannot parse GitHub URL: {repo_url}")
    owner, repo = match.group(1), match.group(2).rstrip(".git")

    headers = {"Accept": "application/vnd.github+json"}
    token = github_token or settings.github_token
    if token:
        headers["Authorization"] = f"Bearer {token}"

    RELEVANT_EXTENSIONS = {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java",
        ".json", ".yaml", ".yml", ".toml", ".env.example",
        ".md", ".txt", ".sh", ".dockerfile",
    }
    RELEVANT_NAMES = {
        "dockerfile", ".env.example", ".gitignore", "makefile",
        "readme.md", "contributing.md", "requirements.txt",
        "package.json", "pyproject.toml", "go.mod",
    }
    MAX_FILE_SIZE = 40_000
    MAX_FILES = 30

    async with httpx.AsyncClient(timeout=30) as client:
        # Get default branch
        repo_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}", headers=headers
        )
        repo_resp.raise_for_status()
        default_branch = repo_resp.json().get("default_branch", "main")

        # Get file tree
        tree_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}",
            headers=headers,
            params={"recursive": "1"},
        )
        tree_resp.raise_for_status()
        tree = tree_resp.json().get("tree", [])

        # Filter relevant files
        files_to_fetch = []
        for item in tree:
            if item.get("type") != "blob":
                continue
            path = item["path"]
            name = path.split("/")[-1].lower()
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in name else ""
            size = item.get("size", 0)
            if size > MAX_FILE_SIZE:
                continue
            if name in RELEVANT_NAMES or ext in RELEVANT_EXTENSIONS:
                files_to_fetch.append(path)
            if len(files_to_fetch) >= MAX_FILES:
                break

        # Fetch file contents
        file_contents: dict[str, str] = {}
        for path in files_to_fetch:
            try:
                content_resp = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/contents/{path}",
                    headers=headers,
                )
                if content_resp.status_code == 200:
                    import base64
                    data = content_resp.json()
                    if data.get("encoding") == "base64":
                        file_contents[path] = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            except Exception:
                pass

        return {
            "owner": owner,
            "repo": repo,
            "default_branch": default_branch,
            "file_tree": [item["path"] for item in tree if item.get("type") == "blob"],
            "file_contents": file_contents,
        }


def _llm_client() -> AsyncAnthropicBedrock:
    return AsyncAnthropicBedrock(
        aws_access_key=settings.aws_access_key_id,
        aws_secret_key=settings.aws_secret_access_key,
        aws_region=settings.aws_region,
    )


class BaseAgent(ABC):
    name: str = "base"

    def __init__(self, band_room_id: str, session_id: str) -> None:
        self.band = BandClient()
        self.room_id = band_room_id
        self.session_id = session_id
        self._llm = _llm_client()

    async def get_band_context(self) -> list[dict]:
        return await self.band.get_room_messages(self.room_id)

    async def post_to_band(
        self,
        output_type: str,
        content: str,
        confidence: float,
        flags: list[str],
        references: list[str] | None = None,
    ) -> str:
        payload = {
            "agent_name": self.name,
            "output_type": output_type,
            "content": content,
            "confidence": confidence,
            "needs_human_review": confidence < 0.7 or bool(flags),
            "flags": flags,
            "references": references or [],
        }
        return await self.band.post_message(self.room_id, payload)

    async def call_llm(self, system: str, user: str, max_tokens: int = 4096) -> str:
        response = await self._llm.messages.create(
            model=settings.bedrock_model_id,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text

    @abstractmethod
    async def run(self, repo: dict, github_token: str | None = None) -> dict:
        """Run agent and return structured result dict."""
