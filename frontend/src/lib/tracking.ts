/** The tracking page of the courier. The tracking link field starts with this, so the agent only types the Order ID after it
 * -- or clears it and pastes a full tracking link. */
export const TRACKING_LINK_PREFIX = "https://sotrue.clickpost.in/en/my-order?order_id=";

/** Nothing real entered yet: empty, or just the untouched prefix. */
export function isBareTrackingLink(value: string): boolean {
  const v = value.trim();
  return v === "" || v === TRACKING_LINK_PREFIX;
}

/** What to save: the untouched prefix counts as "nothing entered". */
export function cleanTrackingLink(value: string): string {
  return isBareTrackingLink(value) ? "" : value.trim();
}

/** A clickable address only when the value really is a web address, exactly as typed -- never a prefix added
 * in front of it. An Order ID typed on its own (no link) is plain text and returns null. */
export function trackingHref(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v || v === TRACKING_LINK_PREFIX) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return null;
}
