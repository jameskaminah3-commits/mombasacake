// Counts page changes inside the shop, so "Back" can return to the previous page when there is one
// instead of leaving the site (e.g. for a customer who opened a shared cake link).
let inAppNavigations = 0;

export function recordInAppNavigation() {
  inAppNavigations += 1;
}

export function hasInAppHistory() {
  return inAppNavigations > 0;
}
