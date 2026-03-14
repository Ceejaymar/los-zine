import { atom, useAtom } from "jotai";
import { useEffect } from "react";

const pictures = [
  "page-1",
  "page-2",
  "page-3",
  "page-4",
  "page-5.mp4",
  "page-6",
  "page-7",
  "page-8",
];

export const pageAtom = atom(0);
export const pages = [
  {
    front: "book-cover",
    back: pictures[0],
  },
];

for (let i = 1; i < pictures.length - 1; i += 2) {
  pages.push({
    front: pictures[i % pictures.length],
    back: pictures[(i + 1) % pictures.length],
  });
}

pages.push({
  front: pictures[pictures.length - 1],
  back: "book-back",
});

export default function UI() {
  const [page, setPage] = useAtom(pageAtom);

  useEffect(() => {
    const audio = new Audio("/audio/page-flip.mp3");
    audio.play();
  }, [page]);

  return (
    <main className=" pointer-events-none select-none z-10 fixed  inset-0  flex justify-between flex-col">
      <a
        className="pointer-events-auto mt-10 ml-10"
        href="https://lessons.wawasensei.dev/courses/react-three-fiber"
      >
        LOS MAGAZINE
      </a>
      <div className="w-full overflow-auto pointer-events-auto flex justify-center">
        <div className="overflow-auto flex items-center gap-4 max-w-full p-10">
          {[...pages].map((_, index) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: okay for now
              key={index}
              className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${
                index === page
                  ? "bg-white/90 text-black"
                  : "bg-black/30 text-white"
              }`}
              onClick={() => setPage(index)}
            >
              {index === 0 ? "Cover" : `Page ${index * 2 - 1} & ${index * 2}`}
            </button>
          ))}
          <button
            type="button"
            className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${
              page === pages.length
                ? "bg-white/90 text-black"
                : "bg-black/30 text-white"
            }`}
            onClick={() => setPage(pages.length)}
          >
            Back Cover
          </button>
        </div>
      </div>
    </main>
  );
}
