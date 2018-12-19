import { EventHandler } from "../../utils";
import { CursorAccessListener } from "../onCursorAccess";

const cursorAccessEventHandler = new EventHandler<CursorAccessListener>();

export const getCursorAccessEventHandler = () => cursorAccessEventHandler;
