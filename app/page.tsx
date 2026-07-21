import BrightApp from "@/components/BrightApp";

/**
 * The app.
 *
 * The implementation lives in components/BrightApp so that / and /v2 render the
 * same thing and cannot drift. /v2 is kept only because it was the comparison
 * route for a day and may be bookmarked.
 *
 * The previous cream/serif design is tagged design/cream-serif-v1.
 */
export default function Page() {
  return <BrightApp />;
}
