import fs from "fs";
import path from "path";
import { Resource, BoardSpace } from "../types/game";

/**
 * Loads initial game data from mock/init.json for local testing.
 * In the future, this can be replaced with an API call to an LLM.
 */
export async function loadInitialGameData(): Promise<{ resources: Resource[]; board: BoardSpace[] }> {
  const filePath = path.join(process.cwd(), "mock", "init.json");
  const data = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(data);
  return {
    resources: parsed.resources,
    board: parsed.board
  };
}

/**
 * Placeholder for calling an LLM to generate resources and board spaces.
 * This function should return the same shape as loadInitialGameData.
 */
export async function generateGameDataWithLLM(): Promise<{ resources: Resource[]; board: BoardSpace[] }> {
  // TODO: Implement LLM API call
  throw new Error("LLM generation not implemented yet");
}
