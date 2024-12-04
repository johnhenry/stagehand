import { Eval } from "braintrust";
import fs from "fs";
import process from "process";
import { EvalFunction } from "../types/evals";
import { AvailableModel } from "../types/model";
import { amazon_add_to_cart } from "./act/amazon_add_to_cart";
import { expedia_search } from "./act/expedia_search";
import { laroche_form } from "./act/laroche_form";
import { peeler_simple } from "./act/peeler_simple";
import { simple_google_search } from "./act/simple_google_search";
import { wikipedia } from "./act/wikipedia";
import { arxiv } from "./combination/arxiv";
import { extract_partners } from "./combination/extract_partners";
import { google_jobs } from "./combination/google_jobs";
import { homedepot } from "./combination/homedepot";
import { peeler_complex } from "./combination/peeler_complex";
import { extract_collaborators } from "./combination/extract_collaborators";
import { extract_github_commits } from "./combination/extract_github_commits";
import { extract_github_stars } from "./extract/extract_github_stars";
import { extract_press_releases } from "./extract/extract_press_releases";
import { extract_aigrant_companies } from "./extract/extract_aigrant_companies";
import { extract_staff_members } from "./extract/extract_staff_members";
import { extract_snowshoeing_destinations } from "./extract/extract_snowshoeing_destinations";
import { costar } from "./observe/costar";
import { vanta } from "./observe/vanta";
import { vanta_h } from "./observe/vanta_h";
import { EvalLogger } from "./utils";
import path from "path";

const env: "BROWSERBASE" | "LOCAL" =
  process.env.EVAL_ENV?.toLowerCase() === "browserbase"
    ? "BROWSERBASE"
    : "LOCAL";

const models: AvailableModel[] = ["gpt-4o", "claude-3-5-sonnet-20241022"];

const tasks: Record<string, EvalFunction> = {
  vanta,
  vanta_h,
  costar,
  peeler_simple,
  peeler_complex,
  wikipedia,
  simple_google_search,
  laroche_form,
  expedia_search,
  amazon_add_to_cart,
  google_jobs,
  homedepot,
  extract_partners,
  arxiv,
  extract_collaborators,
  extract_github_commits,
  extract_github_stars,
  extract_press_releases,
  extract_aigrant_companies,
  extract_staff_members,
  extract_snowshoeing_destinations,
};

const exactMatch = (args: {
  input: any;
  output: any;
  expected?: any;
}): {
  name: string;
  score: number;
} => {
  console.log(`Task "${args.input.name}" returned: ${args.output}`);

  const expected = args.expected ?? true;
  if (expected === true) {
    return {
      name: "Exact match",
      score: args.output === true || args.output?._success == true ? 1 : 0,
    };
  }

  return {
    name: "Exact match",
    score: args.output === expected ? 1 : 0,
  };
};

const errorMatch = (args: {
  input: any;
  output: any;
  expected?: any;
}): {
  name: string;
  score: number;
} => {
  console.log(`Task "${args.input.name}" returned: ${args.output}`);

  return {
    name: "Error rate",
    score: args.output?.error !== undefined ? 1 : 0,
  };
};

const testcases = [
  "vanta",
  "vanta_h",
  ...(env === "BROWSERBASE" ? [] : ["peeler_simple"]), // peeler_simple is not supported on Browserbase
  "wikipedia",
  "peeler_complex",
  "simple_google_search",
  "extract_github_stars",
  "extract_collaborators",
  "extract_github_commits",
  "google_jobs",
  "homedepot",
  "extract_partners",
  "laroche_form",
  "arxiv",
  "amazon_add_to_cart",
  "extract_press_releases",
  "extract_aigrant_companies",
  "extract_staff_members",
  "extract_snowshoeing_destinations",
];

const generateSummary = async (summary: any, results: any[]) => {
  const exactMatchScore = summary.scores?.["Exact match"] || { score: null };

  const taskStatuses = results.map((result) => ({
    name: result.input.name,
    modelName: result.input.modelName,
    success: result.output?._success || false,
  }));

  const totalTasks = taskStatuses.length;

  const passedTasks = taskStatuses
    .filter((task) => task.success)
    .map((task) => ({ name: task.name, modelName: task.modelName }));
  const failedTasks = taskStatuses
    .filter((task) => !task.success)
    .map((task) => ({ name: task.name, modelName: task.modelName }));

  const formattedSummary = {
    exactMatchScore:
      exactMatchScore.score !== null ? exactMatchScore.score * 100 : null,
    totalTasks,
    passedTasks,
    failedTasks,
  };

  fs.writeFileSync(
    "eval-summary.json",
    JSON.stringify(formattedSummary, null, 2),
  );
  console.log("Evaluation summary written to eval-summary.json");
};

const args = process.argv.slice(2);
let filterByCategory: string | null = null;
let filterByEvalName: string | null = null;

if (args.length > 0) {
  if (args[0].toLowerCase() === "category") {
    if (args[1] === "-") {
      filterByCategory = args[2];
    } else {
      filterByCategory = args[1];
    }
    if (!filterByCategory) {
      console.error("Error: Category name not specified.");
      process.exit(1);
    }
    const validCategories = ["extract", "observe", "act", "combination"];
    if (!validCategories.includes(filterByCategory)) {
      console.error(
        `Error: Invalid category "${filterByCategory}". Valid categories are: ${validCategories.join(", ")}`,
      );
      process.exit(1);
    }
  } else {
    filterByEvalName = args[0];
    if (!testcases.includes(filterByEvalName)) {
      console.error(`Error: Evaluation "${filterByEvalName}" does not exist.`);
      process.exit(1);
    }
  }
}

const ciEvals = process.env.CI_EVALS?.split(",").map((e) => e.trim());

const generateFilteredTestcases = () => {
  let allTestcases = models.flatMap((model) =>
    testcases.map((test) => ({
      input: { name: test, modelName: model },
      name: test,
      tags: [model, test],
      metadata: {
        model,
        test,
      },
    })),
  );

  if (ciEvals && ciEvals.length > 0) {
    allTestcases = allTestcases.filter((testcase) =>
      ciEvals.includes(testcase.name),
    );
  }

  if (filterByCategory) {
    allTestcases = allTestcases.filter(
      (testcase) => taskCategories[testcase.name] === filterByCategory,
    );
  }

  if (filterByEvalName) {
    allTestcases = allTestcases.filter(
      (testcase) =>
        testcase.name === filterByEvalName ||
        testcase.input.name === filterByEvalName,
    );
  }

  return allTestcases;
};

const generateTaskCategories = (): Record<string, string> => {
  const categories = ["observe", "act", "combination", "extract"];
  const taskCategories: Record<string, string> = {};

  categories.forEach((category) => {
    const categoryPath = path.join(__dirname, category);
    try {
      const files = fs.readdirSync(categoryPath);
      files.forEach((file) => {
        if (file.endsWith(".ts")) {
          const taskName = file.replace(".ts", "");
          taskCategories[taskName] = category;
        }
      });
    } catch (error) {
      console.warn(`Warning: Category directory ${category} not found`);
    }
  });

  return taskCategories;
};

const taskCategories = generateTaskCategories();

(async () => {
  try {
    const evalResult = await Eval("stagehand", {
      data: generateFilteredTestcases,
      task: async (input: {
        name: keyof typeof tasks;
        modelName: AvailableModel;
      }) => {
        const logger = new EvalLogger();
        try {
          // Execute the task
          const result = await tasks[input.name]({
            modelName: input.modelName,
            logger,
          });
          if (result && result._success) {
            console.log(`✅ ${input.name}: Passed`);
          } else {
            console.log(`❌ ${input.name}: Failed`);
          }
          return result;
        } catch (error) {
          console.error(`❌ ${input.name}: Error - ${error}`);
          logger.error({
            message: `Error in task ${input.name}`,
            level: 0,
            auxiliary: {
              error: {
                value: error,
                type: "object",
              },
              trace: {
                value: error.stack,
                type: "string",
              },
            },
          });
          return {
            _success: false,
            error: JSON.parse(JSON.stringify(error, null, 2)),
            logs: logger.getLogs(),
          };
        }
      },
      scores: [exactMatch, errorMatch],
      maxConcurrency: 20,
      trialCount: 5,
    });

    await generateSummary(evalResult.summary, evalResult.results);
  } catch (error) {
    console.error("Error during evaluation run:", error);
    process.exit(1);
  }
})();
