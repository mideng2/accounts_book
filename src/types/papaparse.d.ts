declare module 'papaparse' {
  interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean;
  }

  interface ParseResult<T> {
    data: T[];
  }

  function parse<T>(input: string, config?: ParseConfig<T>): ParseResult<T>;

  const Papa: {
    parse: typeof parse;
  };

  export default Papa;
}

