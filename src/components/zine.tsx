import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import Page from "./page";
import { pageAtom, pages } from "./ui";

export default function Zine({ ...props }) {
  const [page, _setPage] = useAtom(pageAtom);
  const [delayedPage, setDelayedPage] = useState(page);

  useEffect(() => {
    let timeout: number | undefined;
    const goToPage = () => {
      setDelayedPage((delayedPage) => {
        if (page === delayedPage) {
          return delayedPage;
        } else {
          timeout = setTimeout(
            () => goToPage(),
            Math.abs(page - delayedPage) > 2 ? 50 : 150,
          );
          if (page > delayedPage) {
            return delayedPage + 1;
          }
          if (page < delayedPage) {
            return delayedPage - 1;
          }
          return delayedPage;
        }
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [page]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {[...pages].map((pageData, index) => (
        <Page
          // biome-ignore lint/suspicious/noArrayIndexKey: okay for now
          key={pageData.front}
          number={index}
          page={delayedPage}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
          pageData={pageData}
        />
      ))}
    </group>
  );
}
