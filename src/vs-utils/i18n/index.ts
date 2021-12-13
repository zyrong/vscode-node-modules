import { env } from "vscode";
import { error } from "../util";

// format('星期{0}{1}', ['一','晚上']) => 星期一晚上
function format(message: string, args: string[] = []): string {
  return args.length
    ? message.replace(/\{(\d+)\}/g, (match, rest) => args[rest] || match)
    : message;
}

function init(language: string) {
  let bundle: any = require("./en").default;
  console.log("🚀 ~ file: index.ts ~ line 13 ~ init ~ bundle", bundle);

  try {
    const langpkg = require(`./${language}`);
    bundle = Object.assign(bundle, langpkg.default);
  } catch (err) {
    error("不存在对应语言包", err);
  }

  return function (key: string, ...args: string[]): string {
    const message = bundle[key] || key;
    return format(message, args);
  };
}

export default init(env.language);
