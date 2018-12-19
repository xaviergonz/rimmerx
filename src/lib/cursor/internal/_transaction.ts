import { devMode } from "../../devMode";
import { Disposer, EventHandler } from "../../utils";

let transactionLock = 0;
let currentTransactionId = 0;

function insideTransaction() {
  return transactionLock > 0;
}

export function lockTransaction() {
  transactionLock++;
  return currentTransactionId;
}

export function unlockTransaction() {
  transactionLock--;
  if (devMode && transactionLock < 0) {
    transactionLock = 0;
    throw new Error("assertion error: negative transaction lock");
  }
  if (transactionLock === 0) {
    const finishedTransactionId = currentTransactionId;
    currentTransactionId++;
    const queue = afterTransactionQueue;
    afterTransactionQueue = [];
    queue.forEach(fn => fn(finishedTransactionId));
    transactionFinishedEventHandler.emit(finishedTransactionId);
  }
}

type TransactionFinishedListener = (transactionId: number | undefined) => void;

const transactionFinishedEventHandler = new EventHandler<TransactionFinishedListener>();

export function onTransactionFinished(fn: TransactionFinishedListener): Disposer {
  return transactionFinishedEventHandler.subscribe(fn);
}

type TransactionCallback = (transactionId: number | undefined) => void;

let afterTransactionQueue: TransactionCallback[] = [];

export function runWhenOutsideTransaction(fn: TransactionCallback): void {
  if (!insideTransaction()) {
    fn(undefined);
    transactionFinishedEventHandler.emit(undefined);
  } else {
    afterTransactionQueue.push(fn);
  }
}
