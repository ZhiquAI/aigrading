export {
  ExtensionMessageTypes,
  type ExtensionMessage,
  type ExtensionMessageType
} from "./messages";
export {
  getAllAdapters,
  resolveAdapterByHostname,
  buildQuestionKeyByHostname
} from "./adapters/adapter-registry";
export type { AdapterContext, PlatformAdapter } from "./adapters/types";
