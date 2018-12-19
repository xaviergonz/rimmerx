export class RollbackUpdateError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, RollbackUpdateError.prototype);
  }
}
