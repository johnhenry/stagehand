import { EvalFunction } from "../../types/evals";
import { initStagehand } from "../utils";
import { z } from "zod";

export const extract_rockauto: EvalFunction = async ({ modelName, logger }) => {
  const { stagehand, initResponse } = await initStagehand({
    modelName,
    logger,
  });

  const { debugUrl, sessionUrl } = initResponse;

  await stagehand.page.goto("https://www.rockauto.com/en/catalog/alpine,1974,a310,1.6l+l4,1436055,cooling+system,coolant+/+antifreeze,11393");

  const result = await stagehand.extract({
    instruction: "Extract the full descriptive product info strings (including part number and manufacturer) of all the coolant and antifreeze products in the 'economy' category.",
    schema: z.object({
      coolant_products: z.array(
        z.object({
          product_info_string: z.string(),
        })
      ),
    }),
    modelName,
  });

  await stagehand.close();

  const coolantProducts = result.coolant_products;
  const expectedLength = 4;

  const expectedFirstItem = {
    product_info_string: "FVP GREEN5050GAL Low Silicate Blend; 1 Gallon; Green; IAT",
  };

  const expectedLastItem = {
    product_info_string: "VALVOLINE 719009 Universal Yellow; 1 Gallon",
  };

  if (coolantProducts.length !== expectedLength) {
    logger.error({
      message: "Incorrect number of coolant products extracted",
      level: 0,
      auxiliary: {
        expected: {
          value: expectedLength.toString(),
          type: "integer",
        },
        actual: {
          value: coolantProducts.length.toString(),
          type: "integer",
        },
      },
    });
    return {
      _success: false,
      error: "Incorrect number of coolant products extracted",
      logs: logger.getLogs(),
      debugUrl,
      sessionUrl,
    };
  }
  const firstItemMatches =
    coolantProducts[0].product_info_string === expectedFirstItem.product_info_string;

  if (!firstItemMatches) {
    logger.error({
      message: "First coolant product extracted does not match expected",
      level: 0,
      auxiliary: {
        expected: {
          value: JSON.stringify(expectedFirstItem),
          type: "object",
        },
        actual: {
          value: JSON.stringify(coolantProducts[0]),
          type: "object",
        },
      },
    });
    return {
      _success: false,
      error: "First coolant product extracted does not match expected",
      logs: logger.getLogs(),
      debugUrl,
      sessionUrl,
    };
  }

  const lastItemMatches =
    coolantProducts[coolantProducts.length - 1].product_info_string === expectedLastItem.product_info_string;

  if (!lastItemMatches) {
    logger.error({
      message: "Last coolant product extracted does not match expected",
      level: 0,
      auxiliary: {
        expected: {
          value: JSON.stringify(expectedLastItem),
          type: "object",
        },
        actual: {
          value: JSON.stringify(coolantProducts[coolantProducts.length - 1]),
          type: "object",
        },
      },
    });
    return {
      _success: false,
      error: "Last coolant product extracted does not match expected",
      logs: logger.getLogs(),
      debugUrl,
      sessionUrl,
    };
  }

  return {
    _success: true,
    logs: logger.getLogs(),
    debugUrl,
    sessionUrl,
  };
};