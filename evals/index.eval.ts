import { Eval } from "braintrust";
import fs from "fs";
import path from "path";
import process from "process";
import { EvalFunction } from "../types/evals";
import { AvailableModel } from "../types/model";
import { EvalLogger } from "./utils";

const env: "BROWSERBASE" | "LOCAL" =
  process.env.EVAL_ENV?.toLowerCase() === "browserbase"
    ? "BROWSERBASE"
    : "LOCAL";

const models: AvailableModel[] = ["gpt-4o", "claude-3-5-sonnet-20241022"];

const generateTasks = (): Record<string, EvalFunction> => {
  const tasks: Record<string, EvalFunction> = {};
  const categories = ["observe", "act", "combination", "extract"];

  categories.forEach((category) => {
    const categoryPath = path.join(__dirname, category);
    try {
      const files = fs.readdirSync(categoryPath);
      files.forEach((file) => {
        if (file.endsWith(".ts")) {
          const taskName = file.replace(".ts", "");
          const taskModule = require(`./${category}/${taskName}`);
          tasks[taskName] = taskModule[taskName];
        }
      });
    } catch (error) {
      console.warn(`Warning: Category directory ${category} not found`);
    }
  });

  return tasks;
};

const tasks = generateTasks();

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

const testcases = Object.keys(tasks).filter((name) =>
  env === "BROWSERBASE" ? name !== "peeler_simple" : true,
);

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
