// Демо-адаптер: kkm-browser lobsters frontpage — топ Lobsters (public, без логина).
// Шаблон для новых адаптеров: импортируй хелперы, верни данные — stdout JSON.
import { open, evalJs, close } from "../src/browser.ts";

export default async function () {
  await open("https://lobste.rs/");

  const posts = await evalJs(`
    [...document.querySelectorAll(".story")]
      .slice(0, 25)
      .map(s => ({
        title: s.querySelector("a.u-url")?.innerText?.trim() || null,
        url: s.querySelector("a.u-url")?.href || null,
        comments_url: s.querySelector(".comments_label a")?.href || null,
        comments: s.querySelector(".comments_label a")?.innerText?.trim() || null,
        score: s.querySelector(".score")?.innerText?.trim() || null
      }))
      .filter(p => p.title)
  `);
  await close();
  return posts;
}
