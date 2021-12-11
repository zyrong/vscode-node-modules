import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { extensions } from "vscode";

interface ILanguagePack {
  [key: string]: string;
}

const publisher_name = "zyrong.node-modules"; // extension唯一标识符

export class Localize {
  private bundle = this.resolveLanguagePack();
  private options: { locale: string } = { locale: "" };

  public localize(key: string, ...args: string[]): string {
    const message = this.bundle[key] || key;
    return this.format(message, args);
  }

  private init() {
    try {
      this.options = {
        ...this.options,
        ...JSON.parse(process.env.VSCODE_NLS_CONFIG || "{}"), // 当前vscode语言环境配置
      };
    } catch (err) {
      throw err;
    }
  }

  // format('星期{0}{1}', ['一','晚上']) => 星期一晚上
  private format(message: string, args: string[] = []): string {
    return args.length
      ? message.replace(/\{(\d+)\}/g, (match, rest) => args[rest] || match)
      : message;
  }

  private resolveLanguagePack(): ILanguagePack {
    this.init();

    const languageFormat = "package.nls{0}.json";
    const defaultLanguage = languageFormat.replace("{0}", "");

    // 获取扩展相关信息，如: publisher_name扩展对应的package.json
    const extension = extensions.getExtension(publisher_name);
    if (!extension)
      {throw new Error(
        `extensionId ${publisher_name} error. \nGet an extension by its full identifier in the form of: publisher.name.`
      );}

    const rootPath = extension!.extensionPath; // 该扩展的安装目录

    const resolvedLanguage = this.recurseCandidates(
      rootPath,
      languageFormat,
      this.options.locale
    );

    try {
      const defaultLanguageBundle = JSON.parse(
        defaultLanguage
          ? readFileSync(resolve(rootPath, defaultLanguage), "utf-8")
          : "{}"
      );

      const resolvedLanguageBundle = resolvedLanguage
        ? JSON.parse(readFileSync(resolve(rootPath, resolvedLanguage), "utf-8"))
        : null;

      return { ...defaultLanguageBundle, ...resolvedLanguageBundle };
    } catch (err) {
      throw err;
    }
  }

  private recurseCandidates(
    rootPath: string, // 扩展的安装目录
    format: string,
    candidate: string
  ): string {
    // 寻找对应语言包 package.nls.zh-cn.json
    const filename = format.replace("{0}", `.${candidate}`);
    const filepath = resolve(rootPath, filename);
    if (existsSync(filepath)) {
      return filename;
    }
    // package.nls.zh-cn.json => 尝试寻找package.nls.zh.json
    if (candidate.split("-")[0] !== candidate) {
      return this.recurseCandidates(rootPath, format, candidate.split("-")[0]);
    }
    return "";
  }
}

export default Localize.prototype.localize.bind(new Localize()); // 导出bind实例后的localize方法
