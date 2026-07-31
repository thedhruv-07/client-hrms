import type { User } from "@/types";
import { users } from "./mock/seed";
import { delay } from "./mock/db";

export async function listUsers(): Promise<User[]> {
  return delay([...users]);
}
