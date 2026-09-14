import MangaCard from "./MangaCard";

export default function MangaGrid({ items, getSimilarity }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 xl:gap-6">
      {items.map((manga) => (
        <MangaCard
          key={manga.gold_id}
          manga={manga}
          similarityScore={getSimilarity ? getSimilarity(manga) : undefined}
          tracking={manga.tracking}
        />
      ))}
    </div>
  );
}
