import ecTwoSlash from "expressive-code-twoslash";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

export default {
  plugins: [ecTwoSlash(), pluginLineNumbers(), pluginCollapsibleSections()],
  themes: ["github-light", "github-dark"],
  defaultProps: {
    showLineNumbers: false,
  },
};
