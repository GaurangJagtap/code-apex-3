from urllib.parse import urljoin, urlparse
from typing import Dict, Any, List, Set
from playwright.async_api import Page
from backend.app.core.security import is_url_allowed

class ScoutAgent:
    """
    Scout Agent: Explores the application, extracts interactive DOM elements,
    identifies forms and controls, and discovers reachable application routes.
    """
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.visited_urls: Set[str] = set()
        self.discovered_urls: Set[str] = {base_url}
        self.navigation_graph: Dict[str, List[str]] = {}

    async def inspect_page(self, page: Page) -> Dict[str, Any]:
        """Inspects current page DOM, forms, links, and accessibility roles."""
        current_url = page.url
        title = await page.title()

        # Extract all interactive controls
        controls = await page.evaluate("""() => {
            const results = [];
            
            // Buttons
            document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => {
                if (el.offsetParent !== null) { // visible
                    results.push({
                        tag: el.tagName.toLowerCase(),
                        role: 'button',
                        id: el.id || null,
                        name: el.getAttribute('name') || null,
                        text: (el.innerText || el.value || '').trim().substring(0, 50),
                        selector: el.id ? '#' + el.id : (el.className ? '.' + el.className.split(' ')[0] : 'button')
                    });
                }
            });

            // Inputs
            document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea').forEach(el => {
                if (el.offsetParent !== null) {
                    results.push({
                        tag: el.tagName.toLowerCase(),
                        type: el.type || 'text',
                        role: 'input',
                        id: el.id || null,
                        name: el.getAttribute('name') || null,
                        placeholder: el.placeholder || null,
                        selector: el.id ? '#' + el.id : (el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase())
                    });
                }
            });

            return results;
        }""")

        # Extract links
        raw_links = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.getAttribute('href'))
                .filter(Boolean);
        }""")

        base_parsed = urlparse(self.base_url)
        base_path = base_parsed.path.rstrip("/")

        valid_links = []
        for raw in raw_links:
            if raw.startswith("javascript:") or raw.startswith("mailto:") or raw.startswith("#"):
                continue
            full_url = urljoin(current_url, raw)
            # Normalize url (remove query params or hash for site map clustering)
            parsed = urlparse(full_url)
            norm_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
            # Scope check: origin must match base_url origin
            if not is_url_allowed(norm_url) or parsed.netloc != base_parsed.netloc:
                continue

            # Path scoping: If testing a sub-application (e.g. /assessment), restrict to that path prefix
            if base_path and base_path != "":
                if not (parsed.path == base_path or parsed.path.startswith(base_path + "/")):
                    continue
            else:
                # If testing root DevStore, keep e-commerce scope separate from sample sub-apps
                sub_app_prefixes = ("/assessment", "/assesspro", "/quickbite")
                if any(parsed.path == p or parsed.path.startswith(p + "/") for p in sub_app_prefixes):
                    continue

            valid_links.append(norm_url)
            if norm_url not in self.visited_urls:
                self.discovered_urls.add(norm_url)

        self.visited_urls.add(current_url)
        self.navigation_graph[current_url] = list(set(valid_links))

        return {
            "url": current_url,
            "title": title,
            "controls": controls,
            "links": list(set(valid_links)),
            "unexplored_count": len(self.discovered_urls - self.visited_urls)
        }

    async def explore_graph(
        self,
        page: Page,
        max_pages: int = 8,
        max_depth: int = 2,
        action_timeout_ms: int = 6000
    ) -> List[Dict[str, Any]]:
        """
        Executes multi-hop autonomous graph exploration using breadth-first traversal.
        Discovers pages, controls, forms, and transitions while avoiding loops and respecting budgets.
        """
        inspections: List[Dict[str, Any]] = []
        queue = [(self.base_url, 0)]

        while queue and len(inspections) < max_pages:
            target_url, depth = queue.pop(0)
            
            # Normalize URL
            parsed = urlparse(target_url)
            norm_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
            if norm_url in self.visited_urls and len(inspections) > 0:
                continue

            try:
                await page.goto(target_url, wait_until="domcontentloaded", timeout=action_timeout_ms)
                inspection = await self.inspect_page(page)
                inspection["depth"] = depth
                inspections.append(inspection)

                # If within depth budget, enqueue newly discovered unvisited links
                if depth < max_depth:
                    for link in inspection["links"]:
                        parsed_link = urlparse(link)
                        norm_link = f"{parsed_link.scheme}://{parsed_link.netloc}{parsed_link.path}"
                        if norm_link not in self.visited_urls:
                            queue.append((link, depth + 1))
            except Exception:
                continue

        return inspections
