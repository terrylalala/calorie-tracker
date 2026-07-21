import BrightApp from "@/components/BrightApp";

/**
 * Alias of /. Kept because this path was the comparison route while the
 * redesign was being judged, so it may be bookmarked or open in a tab; it
 * renders the same component rather than redirecting, so a stale bookmark
 * simply works.
 */
export default function V2Page() {
  return <BrightApp />;
}
