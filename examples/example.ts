import { Stagehand } from "../lib";
import { z } from "zod";

async function example() {
  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    debugDom: true,
    enableCaching: false,
    modelName: "llama3.2-vision:11b",
  });

  await stagehand.init();
  await stagehand.page.goto("https://github.com/browserbase/stagehand");
  await stagehand.act({ action: "click on the contributors" });
  const contributor = await stagehand.extract({
    instruction: "extract the top contributor",
    schema: z.object({
      username: z.string(),
      url: z.string(),
    }),
  });
  console.log({ contributor });

  console.log(`Our favorite contributor is ${contributor.username}`);

  await stagehand.close();
}

(async () => {
  await example();
})();
