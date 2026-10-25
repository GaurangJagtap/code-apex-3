import os
from typing import Optional, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont

class ImageAnnotator:
    """
    Produces visually annotated failure evidence without modifying the original screenshot.
    Draws highlighted bounding boxes, contrasting alert borders, and human-readable badges
    around the failing element or page region.
    """

    @staticmethod
    def annotate_failure(
        source_image_path: str,
        output_image_path: str,
        bounding_box: Optional[Dict[str, float]] = None,
        label: str = "Defect Detected",
        severity: str = "High"
    ) -> bool:
        """
        Loads the source screenshot, adds an annotation layer with element bounds or failure banner,
        and saves to output_image_path.
        """
        if not os.path.exists(source_image_path):
            return False

        try:
            with Image.open(source_image_path) as base_img:
                img = base_img.convert("RGBA")
                overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
                draw = ImageDraw.Draw(overlay)
                w, h = img.size

                # Color palette
                # Red for critical/high, Amber for medium, Blue for low/neutral
                if severity in ("Critical", "High"):
                    outline_color = (220, 38, 38, 255) # Red-600
                    fill_color = (239, 68, 68, 45)      # Translucent Red
                    badge_bg = (220, 38, 38, 235)
                elif severity == "Medium":
                    outline_color = (217, 119, 6, 255) # Amber-600
                    fill_color = (245, 158, 11, 45)     # Translucent Amber
                    badge_bg = (217, 119, 6, 235)
                else:
                    outline_color = (2, 132, 199, 255) # Sky-600
                    fill_color = (14, 165, 233, 40)
                    badge_bg = (2, 132, 199, 235)

                text_color = (255, 255, 255, 255)

                # Attempt default or standard font
                try:
                    font = ImageFont.truetype("arial.ttf", 16)
                    font_bold = ImageFont.truetype("arialbd.ttf", 15)
                except Exception:
                    font = ImageFont.load_default()
                    font_bold = font

                if bounding_box and bounding_box.get("width", 0) > 0 and bounding_box.get("height", 0) > 0:
                    bx = float(bounding_box["x"])
                    by = float(bounding_box["y"])
                    bw = float(bounding_box["width"])
                    bh = float(bounding_box["height"])

                    # Clamp to image boundaries
                    x1 = max(0, min(w - 2, bx - 4))
                    y1 = max(0, min(h - 2, by - 4))
                    x2 = max(2, min(w, bx + bw + 4))
                    y2 = max(2, min(h, by + bh + 4))

                    # 1. Translucent box fill
                    draw.rectangle([x1, y1, x2, y2], fill=fill_color)

                    # 2. Pulsed thick border (3px)
                    for offset in range(3):
                        draw.rectangle([x1 - offset, y1 - offset, x2 + offset, y2 + offset], outline=outline_color)

                    # 3. Label tag above or inside box
                    clean_label = f"FAILURE: {label[:65]}"
                    text_bbox = draw.textbbox((0, 0), clean_label, font=font_bold)
                    text_w = text_bbox[2] - text_bbox[0]
                    text_h = text_bbox[3] - text_bbox[1]

                    tag_y1 = y1 - text_h - 10 if y1 >= text_h + 12 else y2 + 4
                    tag_y2 = tag_y1 + text_h + 8
                    tag_x1 = max(4, min(w - text_w - 16, x1))
                    tag_x2 = tag_x1 + text_w + 14

                    draw.rectangle([tag_x1, tag_y1, tag_x2, tag_y2], fill=badge_bg)
                    draw.rectangle([tag_x1, tag_y1, tag_x2, tag_y2], outline=(255, 255, 255, 220), width=1)
                    draw.text((tag_x1 + 7, tag_y1 + 4), clean_label, fill=text_color, font=font_bold)

                else:
                    # Viewport-level alert border and top banner when element geometry is not isolated
                    border_thickness = 6
                    draw.rectangle([0, 0, w, border_thickness], fill=outline_color)
                    draw.rectangle([0, 0, border_thickness, h], fill=outline_color)
                    draw.rectangle([w - border_thickness, 0, w, h], fill=outline_color)
                    draw.rectangle([0, h - border_thickness, w, h], fill=outline_color)

                    banner_h = 42
                    draw.rectangle([0, 0, w, banner_h], fill=badge_bg)
                    banner_text = f"FAILING STEP EVIDENCE &bull; {label[:80]}"
                    draw.text((16, 12), banner_text, fill=text_color, font=font_bold)

                # Composite overlay onto original image
                annotated = Image.alpha_composite(img, overlay).convert("RGB")
                os.makedirs(os.path.dirname(output_image_path), exist_ok=True)
                annotated.save(output_image_path, "PNG", optimize=True)
                return True

        except Exception as e:
            print(f"[ImageAnnotator] Error generating annotated screenshot: {e}")
            return False
