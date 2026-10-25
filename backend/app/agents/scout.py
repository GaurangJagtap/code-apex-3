from urllib.parse import urljoin, urlparse
from typing import Dict, Any, List, Set, Optional, Callable
from playwright.async_api import Page
from backend.app.core.security import is_url_allowed

class ScoutAgent:
    """
    Scout Agent: Explores the application, extracts interactive DOM elements,
    identifies forms, headings, accessibility roles, and discovers reachable application routes.
    Emits real-time exploration activity events.
    """
    def __init__(self, base_url: str, on_event: Optional[Callable[[str, str, Dict[str, Any]], Any]] = None):
        self.base_url = base_url
        self.on_event = on_event
        self.visited_urls: Set[str] = set()
        self.discovered_urls: Set[str] = {base_url}
        self.navigation_graph: Dict[str, List[str]] = {}

    async def _emit(self, event_type: str, message: str, details: Optional[Dict[str, Any]] = None):
        if self.on_event:
            try:
                res = self.on_event(event_type, message, details or {})
                if hasattr(res, "__await__"):
                    await res
            except Exception:
                pass

    async def inspect_page(self, page: Page) -> Dict[str, Any]:
        """Inspects current page DOM, forms, headings, links, accessibility roles, and viewport."""
        current_url = page.url
        title = await page.title()

        # Detailed DOM property extraction
        dom_data = await page.evaluate("""() => {
            const results = {
                headings: [],
                controls: [],
                forms: [],
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };

            // 1. Headings
            document.querySelectorAll('h1, h2, h3').forEach((el, idx) => {
                const text = (el.innerText || '').trim();
                if (text && el.offsetParent !== null) {
                    results.headings.push({
                        obs_id: `obs-hdg-${idx + 1}`,
                        tag: el.tagName.toLowerCase(),
                        text: text.substring(0, 80),
                        selector: el.id ? '#' + el.id : el.tagName.toLowerCase()
                    });
                }
            });

            // 2. Forms
            document.querySelectorAll('form').forEach((form, fIdx) => {
                const fId = form.id || form.getAttribute('name') || `form-${fIdx + 1}`;
                const inputsInForm = Array.from(form.querySelectorAll('input, select, textarea')).map(i => ({
                    tag: i.tagName.toLowerCase(),
                    type: i.type || 'text',
                    name: i.getAttribute('name') || i.id || null,
                    required: i.hasAttribute('required')
                }));
                results.forms.push({
                    obs_id: `obs-form-${fIdx + 1}`,
                    form_id: fId,
                    action: form.getAttribute('action') || null,
                    method: (form.getAttribute('method') || 'GET').toUpperCase(),
                    fields_count: inputsInForm.length,
                    fields: inputsInForm
                });
            });

            // 3. Interactive Controls: Buttons & Clickables
            let ctrlIdx = 0;
            document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
                if (el.offsetParent !== null) {
                    ctrlIdx++;
                    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
                    results.controls.push({
                        obs_id: `obs-btn-${ctrlIdx}`,
                        tag: el.tagName.toLowerCase(),
                        role: 'button',
                        type: el.type || 'button',
                        id: el.id || null,
                        name: el.getAttribute('name') || null,
                        text: text.substring(0, 60),
                        accessible_name: el.getAttribute('aria-label') || text.substring(0, 60) || null,
                        enabled: !el.disabled,
                        selector: el.id ? '#' + el.id : (el.className ? '.' + el.className.split(' ').filter(c => !c.includes(':'))[0] : 'button')
                    });
                }
            });

            // 4. Interactive Controls: Inputs, Selects, Textareas
            let inputIdx = 0;
            document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach(el => {
                if (el.offsetParent !== null) {
                    inputIdx++;
                    const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : el.closest('label');
                    const labelText = labelEl ? labelEl.innerText.trim() : null;
                    results.controls.push({
                        obs_id: `obs-inp-${inputIdx}`,
                        tag: el.tagName.toLowerCase(),
                        type: el.type || 'text',
                        role: 'input',
                        id: el.id || null,
                        name: el.getAttribute('name') || null,
                        placeholder: el.placeholder || null,
                        label: labelText,
                        required: el.hasAttribute('required'),
                        enabled: !el.disabled,
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
            parsed = urlparse(full_url)
            norm_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
            if not is_url_allowed(norm_url) or parsed.netloc != base_parsed.netloc:
                continue

            if base_path and base_path != "":
                if not (parsed.path == base_path or parsed.path.startswith(base_path + "/")):
                    continue
            else:
                sub_app_prefixes = ("/assessment", "/assesspro", "/quickbite")
                if any(parsed.path == p or parsed.path.startswith(p + "/") for p in sub_app_prefixes):
                    continue

            valid_links.append(norm_url)
            if norm_url not in self.visited_urls:
                self.discovered_urls.add(norm_url)

        self.visited_urls.add(current_url)
        self.navigation_graph[current_url] = list(set(valid_links))

        controls = dom_data.get("controls", [])
        headings = dom_data.get("headings", [])
        forms = dom_data.get("forms", [])
        viewport = dom_data.get("viewport", {"width": 1280, "height": 800})

        return {
            "url": current_url,
            "title": title,
            "headings": headings,
            "controls": controls,
            "forms": forms,
            "viewport": viewport,
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
            
            parsed = urlparse(target_url)
            norm_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
            if norm_url in self.visited_urls and len(inspections) > 0:
                continue

            try:
                await self._emit("EXPLORATION_NAVIGATED", f"Browser navigated to {target_url} (depth: {depth})", {"url": target_url, "depth": depth})
                await page.goto(target_url, wait_until="domcontentloaded", timeout=action_timeout_ms)
                
                inspection = await self.inspect_page(page)
                inspection["depth"] = depth
                inspections.append(inspection)

                ctrl_cnt = len(inspection.get("controls", []))
                forms_cnt = len(inspection.get("forms", []))
                links_cnt = len(inspection.get("links", []))
                
                await self._emit(
                    "OBSERVATION_CAPTURED",
                    f"Captured properties for '{inspection['title'] or norm_url}': {ctrl_cnt} controls, {forms_cnt} forms, {links_cnt} links.",
                    {
                        "url": norm_url,
                        "title": inspection.get("title"),
                        "controls_count": ctrl_cnt,
                        "forms_count": forms_cnt,
                        "links_count": links_cnt,
                        "sample_controls": inspection.get("controls", [])[:5]
                    }
                )

                if depth < max_depth:
                    for link in inspection["links"]:
                        parsed_link = urlparse(link)
                        norm_link = f"{parsed_link.scheme}://{parsed_link.netloc}{parsed_link.path}"
                        if norm_link not in self.visited_urls:
                            queue.append((link, depth + 1))
            except Exception as e:
                await self._emit("EXPLORATION_ERROR", f"Failed exploring route {target_url}: {str(e)}", {"url": target_url, "error": str(e)})
                continue

        return inspections
