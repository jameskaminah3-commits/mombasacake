// Sticky header (56px) + the category bar that appears once you scroll (52px) + breathing room.
export const SECTION_SCROLL_OFFSET = 120;

export const categorySectionId = (categoryId: number) => `category-${categoryId}`;

export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const element = document.getElementById(id);
  if (!element) return false;
  window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - SECTION_SCROLL_OFFSET, behavior });
  return true;
}
