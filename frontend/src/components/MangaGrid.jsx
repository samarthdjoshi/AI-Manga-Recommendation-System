import MangaCard from "./MangaCard";

export default function MangaGrid({ items, mangas, getSimilarity }) {
  const list = items || mangas || [];
  if (!list || list.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6 gap-3.5 sm:gap-4 lg:gap-5">
      {list.map((manga) => (
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
