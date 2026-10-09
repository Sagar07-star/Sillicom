import re
from datetime import date, datetime, time, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from dateutil.parser import parse
TOPICS = {
    "AI": ("ai", "llm", "machine learning", "inference", "neural"),
    "Web": ("web", "react", "javascript", "browser", "css", "fastapi", "vscode", "next.js", "tailwind"),
    "Security": ("security", "vulnerability", "privacy", "encryption", "breach"),
    "Mobile": ("mobile", "android", "ios", "expo", "react-native", "iphone"),
    "Startups": ("startup", "funding", "launch", "founder", "venture"),
    "Open Source": ("open source", "github", "release", "python", "linux"),
    "Gaming": ("gaming", "game", "unity", "unreal", "xbox"),
    "Cloud": ("cloud", "aws", "azure", "kubernetes", "serverless", "devops"),
}
class TextOnly(HTMLParser):
    def __init__(self): super().__init__(); self.parts = []; self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.hidden += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)
def clean(value: str, limit: int = 200):
    p = TextOnly(); p.feed(value or "")
    value = re.sub(r"\s+", " ", unescape(" ".join(p.parts))).strip()
    return value if len(value) <= limit else value[:limit-1].rsplit(" ", 1)[0] + "…"
def canonicalize(url: str):
    p = urlsplit(url.strip())
    if p.scheme not in ("http", "https") or not p.hostname or p.username: raise ValueError("Invalid public URL")
    host = p.hostname.lower()
    if ":" in host: host = f"[{host}]"
    if p.port and not (p.scheme == "https" and p.port == 443 or p.scheme == "http" and p.port == 80): host += f":{p.port}"
    query = [(k,v) for k,v in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_") and k.lower() not in {"fbclid","gclid","dclid","mc_cid","mc_eid","ref_src","igshid"}]
    return urlunsplit((p.scheme.lower(), host, p.path.rstrip("/") or "/", urlencode(sorted(query)), ""))
def utc(value, end=False):
    if value is None: return None
    if isinstance(value, date) and not isinstance(value, datetime): value = datetime.combine(value + timedelta(days=int(end)), time.min)
    elif isinstance(value, str):
        day = bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)); value = parse(value)
        if end and day: value += timedelta(days=1)
    if value.tzinfo: value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value

def auto_tags(value, hints=()):
    value = value.lower(); scored = []
    for tag, words in TOPICS.items():
        score = sum(bool(re.search(r"(?<!\w)"+re.escape(word)+r"(?!\w)", value)) for word in words) + (2 if tag in hints else 0)
        if score: scored.append((score, tag))
    return [tag for _,tag in sorted(scored, reverse=True)] or ["Web"]
def why_it_matters(tags):
    return {
        "AI": "A signal to watch as AI tools and developer workflows evolve.",
        "Web": "Worth checking for changes to the tools you use to build for the web.",
        "Security": "May affect how you protect your software, accounts or data.",
        "Mobile": "A useful signal for people building or using mobile products.",
        "Startups": "Offers a glimpse of where founders and new products are heading.",
        "Open Source": "Could introduce a useful improvement to your open source toolkit.",
        "Gaming": "Highlights a change in games or the tools used to build them.",
        "Cloud": "Worth watching for changes to deployment and infrastructure workflows.",
    }[tags[0]]
def generate_why_it_matters_llm(title, summary, tags):
    """LLM integration point: currently a complete, deterministic fallback."""
    return why_it_matters(tags)
