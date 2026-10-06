import { open, evalJs, close } from "../../browser.ts";

export default async function () {
  await open("https://news.ycombinator.com");
  const posts = await evalJs(`
    [...document.querySelectorAll("tr.athing")].map(tr => ({
      id: tr.id,
      title: tr.querySelector(".titleline a")?.textContent,
      url: tr.querySelector(".titleline a")?.href,
      score: tr.nextElementSibling?.querySelector(".score")?.textContent
    }))
  `);
  await close();
  return posts;
}
