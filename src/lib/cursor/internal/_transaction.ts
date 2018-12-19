import { devMode } from "../../devMode";

let transactionLock = 0;

function insideTransaction() {
  return transactionLock > 0;
}

export function lockTransaction() {
  transactionLock++;
}

export function unlockTransaction() {
  transactionLock--;
  if (devMode && transactionLock < 0) {
    transactionLock = 0;
    throw new Error("assertion error: negative transaction lock");
  }
  if (transactionLock === 0) {
    const queue = afterTransactionQueue;
    afterTransactionQueue = [];
    queue.forEach(fn => fn());
  }
}

let afterTransactionQueue: (() => void)[] = [];

export function runWhenNoTransaction(fn: () => void): void {
  if (!insideTransaction()) {
    fn();
  } else {
    afterTransactionQueue.push(fn);
  }
}
