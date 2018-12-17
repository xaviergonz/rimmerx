class RollbackUpdateError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, RollbackUpdateError.prototype);
  }
}

export const rollbackUpdate = new RollbackUpdateError();

export function isRollbackUpdate(err: Error): err is RollbackUpdateError {
  return err instanceof RollbackUpdateError;
}
