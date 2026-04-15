import iconfontConfig from "@/assets/icons/iconfont.json";

type IconfontGlyph = {
  name: string;
  font_class: string;
};

type IconfontConfig = {
  css_prefix_text: string;
  glyphs: IconfontGlyph[];
};

const typedConfig = iconfontConfig as IconfontConfig;

export const iconfontPrefix = typedConfig.css_prefix_text;

export const categoryIconOptions = typedConfig.glyphs.map((glyph) => ({
  value: glyph.font_class,
  label: glyph.name,
}));

export const categoryIconNameSet = new Set(
  categoryIconOptions.map((item) => item.value),
);

export const defaultCategoryIcon = categoryIconOptions[0]?.value ?? "qita";
