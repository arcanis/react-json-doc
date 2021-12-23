import React from 'react';

export type Theme = {
  plain: React.CSSProperties;
  styles: {
    style: Record<string, React.CSSProperties>;
    types: string[];
  }[];
};

export type ExtraTheme = {
  container?: React.CSSProperties,
  activeHeader?: React.CSSProperties,
  inactiveHeader?: React.CSSProperties,
  annotation?: React.CSSProperties,
  section?: React.CSSProperties,
};

enum TokenType {
  L_CURLY,
  R_CURLY,
  L_BRACKET,
  R_BRACKET,
  COMMA,
  COLON,
  NL,
  SPACE,
}

function JsonSchemaAnnotation({extraTheme, children}: {extraTheme: ExtraTheme, children: React.ReactNode}) {
  return (
    <div style={{marginBottom: `1rem`, borderRadius: `var(--ifm-pre-background, 0.25rem)`, padding: `1rem`, whiteSpace: `normal`, ...extraTheme.annotation}}>
      {children}
    </div>
  );
}

function getCurrentHash() {
  return window.location.hash.slice(1);
}

export function JsonDoc({
  theme,
  extraTheme,
  linkComponent: Link = `a`,
  data,
}: {
  theme: Theme;
  extraTheme: ExtraTheme;
  linkComponent?: React.ElementType<{href: string, children?: React.ReactNode}>;
  data: any;
}) {
  const styleByType = new Map<string, any>();
  for (const {style, types} of theme.styles)
    for (const type of types)
      styleByType.set(type, style);

  const activeId = getCurrentHash();

  const sections: Array<{
    id: string | null;
    header: React.ReactNode;
    closed: boolean;
    lines: Array<{indent: number, tokens: Array<React.ReactNode>}>;
  }> = [{
    id: null,
    header: null,
    closed: false,
    lines: [{indent: 0, tokens: []}],
  }];

  const idSegments: Array<string> = [];

  const indentSize = 24;
  let indentCount = 0;

  const indentedBlock = (lTok: TokenType, rTok: TokenType, fn: () => void) => {
    pushToken(lTok);
    pushToken(TokenType.NL);

    indentCount += 1;
    fn();
    indentCount -= 1;

    pushToken(rTok);
  };

  const startNewSection = (header: React.ReactNode = null) => {
    sections.push({
      id: header ? idSegments.join(`.`) : null,
      header,
      closed: false,
      lines: [{indent: 0, tokens: []}],
    });
  };

  const closeSection = () => {
    const section = sections[sections.length - 1];

    if (section.header) {
      section.closed = true;
    }
  };

  const getCurrentId = () => {
    const section = sections[sections.length - 1];

    return section.closed ? null : section.id;
  };

  const startNewLine = () => {
    const initialSection = sections[sections.length - 1];
    if (initialSection.closed) {
      startNewSection();
      return;
    }

    const section = sections[sections.length - 1];
    section.lines.push({indent: 0, tokens: []});
  };

  const getIndentedLine = () => {
    const initialSection = sections[sections.length - 1];
    if (initialSection.closed)
      startNewSection();

    const section = sections[sections.length - 1];
    const line = section.lines[section.lines.length - 1];

    if (line.tokens.length === 0)
      line.indent = indentCount;

    return line.tokens;
  };

  const pushIdentifier = (name: string) => {
    const id = getCurrentId();
    const style = styleByType.get(`attr-name`);

    getIndentedLine().push(
      <Link href={`#${id}`}>
        <a style={style}>
          {name}
        </a>
      </Link>,
    );
  };

  const pushString = (str: string) => {
    const style = styleByType.get(`string`);

    getIndentedLine().push(
      <span style={style}>
        {JSON.stringify(str)}
      </span>,
    );
  };

  const pushNumber = (val: number) => {
    const style = styleByType.get(`number`);

    getIndentedLine().push(
      <span style={style}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushBoolean = (val: boolean) => {
    const style = styleByType.get(`keyword`);

    getIndentedLine().push(
      <span style={style}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushSyntaxToken = (raw: string) => {
    const style = styleByType.get(`punctuation`);

    getIndentedLine().push(
      <span style={style}>
        {raw}
      </span>,
    );
  };

  const pushToken = (token: TokenType) => {
    switch (token) {
      case TokenType.L_CURLY: {
        pushSyntaxToken(`{`);
      } break;

      case TokenType.R_CURLY: {
        pushSyntaxToken(`}`);
      } break;

      case TokenType.L_BRACKET: {
        pushSyntaxToken(`[`);
      } break;

      case TokenType.R_BRACKET: {
        pushSyntaxToken(`]`);
      } break;

      case TokenType.COMMA: {
        pushSyntaxToken(`,`);
      } break;

      case TokenType.COLON: {
        pushSyntaxToken(`:`);
      } break;

      case TokenType.SPACE: {
        getIndentedLine().push(` `);
      } break;

      case TokenType.NL: {
        startNewLine();
      } break;

      default: {
        throw new Error(`Unsupported token type ${token}`);
      } break;
    }
  };

  const processPattern = (patterns: Record<string, any>, key: string) => {
    for (const [pattern, spec] of Object.entries(patterns)) {
      if (key.match(new RegExp(pattern))) {
        process(spec);
        return;
      }
    }

    pushIdentifier(`error`);
  };

  const process = (node: any) => {
    switch (node.type) {
      case `number`: {
        pushNumber(node.examples[0]);
      } break;

      case `boolean`: {
        pushBoolean(node.examples[0]);
      } break;

      case `string`: {
        pushString(node.examples[0]);
      } break;

      case `array`: {
        pushToken(TokenType.L_BRACKET);

        for (let t = 0; t < node.exampleItems.length; ++t) {
          if (t > 0) {
            pushToken(TokenType.COMMA);
            pushToken(TokenType.SPACE);
          }

          process({...node.items, examples: [node.exampleItems[t]]});
        }

        pushToken(TokenType.R_BRACKET);
      } break;

      case `object`: {
        indentedBlock(TokenType.L_CURLY, TokenType.R_CURLY, () => {
          if (node.exampleKeys) {
            for (const exampleKey of node.exampleKeys) {
              pushIdentifier(exampleKey);
              pushToken(TokenType.COLON);
              pushToken(TokenType.SPACE);

              processPattern(node.patternProperties, exampleKey);

              pushToken(TokenType.COMMA);
              pushToken(TokenType.NL);

              closeSection();
            }
          } else {
            for (const [propertyName, propertyNode] of Object.entries<any>(node.properties)) {
              idSegments.push(propertyName);

              if (typeof propertyNode.description !== `undefined`)
                startNewSection(<JsonSchemaAnnotation extraTheme={extraTheme} children={propertyNode.description}/>);

              pushIdentifier(propertyName);
              pushToken(TokenType.COLON);
              pushToken(TokenType.SPACE);

              process(propertyNode);

              pushToken(TokenType.COMMA);
              pushToken(TokenType.NL);

              idSegments.pop();

              closeSection();
            }
          }
        });
      } break;
    }
  };

  process(data);

  return (
    <div style={{padding: `1rem`, paddingTop: `2rem`, whiteSpace: `pre`, ...theme.plain, ...extraTheme.container}}>
      {sections.map(({id, header, lines}, index) => {
        const sectionIndent = Math.min(...lines.filter(line => {
          return line.tokens.length > 0;
        }).map(line => {
          return line.indent;
        }));

        let sectionRender: React.ReactNode = lines.map(({indent, tokens}, lineIndex) => (
          <div key={lineIndex} style={{marginLeft: (indent - sectionIndent) * indentSize, ...extraTheme.section}}>
            {tokens}
          </div>
        ));

        if (header) {
          sectionRender = (
            <div key={index} style={{position: `relative`, marginTop: `1rem`, marginBottom: `1rem`, padding: `1rem`, ...id === activeId ? extraTheme.activeHeader : extraTheme.inactiveHeader}}>
              <div id={id ?? undefined} style={{position: `absolute`, marginTop: `-2rem`, width: `100%`}}/>
              {header}
              {sectionRender}
            </div>
          );
        }

        return (
          <div key={index} style={{marginTop: `-1rem`, marginLeft: sectionIndent * indentSize}}>
            {sectionRender}
          </div>
        );
      })}
    </div>
  );
}
