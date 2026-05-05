type Props = {
  text: string;
  query: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders `text` with all case-insensitive occurrences of `query` wrapped in
 * <strong>. Used to bold the matched substring inside city search results.
 */
export function HighlightMatch({ text, query }: Props) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const re = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(re);
  const lower = trimmed.toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <strong key={i} className="text-foreground font-semibold">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
