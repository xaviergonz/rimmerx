import { RollbackUpdateError } from "./internal/_rollbackUpdate";

export const rollbackUpdate = new RollbackUpdateError();

export function isRollbackUpdate(err: Error): err is RollbackUpdateError {
  return err instanceof RollbackUpdateError;
}
