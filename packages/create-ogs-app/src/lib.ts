/**
 * create-ogs-app as a library, for generators that make an app as one part of something bigger
 * (create-ogs-game makes the web game and this app together).
 */
export { generateApp, TargetNotEmptyError, TEMPLATE_DIR } from "./generate";
export { type Answers, AnswersSchema, SHELL_VERSION } from "./options";
export { brandColor, findPlaceholders, placeholderValues, renderTemplate } from "./placeholders";
export { ASSETS } from "./plan";
export { drawAsset } from "./png";
