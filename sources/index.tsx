import React, {useEffect, useState} from 'react';

export type Theme = {
  plain: React.CSSProperties;
  styles: Array<{
    style: Record<string, React.CSSProperties>;
    types: Array<string>;
  }>;
};

export type ExtraTheme = {
  container?: React.CSSProperties;
  activeHeader?: React.CSSProperties;
  inactiveHeader?: React.CSSProperties;
  annotation?: React.CSSProperties;
  anchor?: React.CSSProperties;
  section?: React.CSSProperties;
  identifier?: React.CSSProperties;
};

enum TokenType {
  L_CURLY,
  R_CURLY,
  L_BRACKET,
  R_BRACKET,
  COMMA,
  COLON,
  PIPE,
  NL,
  SPACE,
}

function prettify(text: string) {
  return text.split(/\n/g).map((line, index) => <div key={index} style={{marginTop: index > 0 ? `1rem` : 0}}>{line}</div>);
}

function JsonSchemaAnnotation({extraTheme, children}: {extraTheme: ExtraTheme, children: React.ReactNode}) {
  return (
    <div className={`rjd-annotation`} style={{marginBottom: `1rem`, borderRadius: `var(--ifm-pre-background, 0.25rem)`, padding: `1rem`, whiteSpace: `normal`, ...extraTheme.annotation}}>
      {children}
    </div>
  );
}

function getCurrentHash() {
  return window.location.hash.slice(1);
}

export function JsonDoc({
  theme,
  descriptionRenderer = {render: prettify},
  extraTheme,
  linkComponent: Link = `a`,
  skipFirstIndent = true,
  data,
}: {
  theme: Theme;
  descriptionRenderer?: any;
  extraTheme: ExtraTheme;
  skipFirstIndent?: boolean;
  linkComponent?: React.ElementType<{href: string, children?: React.ReactNode}>;
  data: any;
}) {
  const styleByType = new Map<string, any>();
  for (const {style, types} of theme.styles)
    for (const type of types)
      styleByType.set(type, style);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getCurrentHash());
  });

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

  const isInlineContext = [false];
  let onTokenPush: ((tok?: TokenType) => void) | null = null;

  const indentedBlock = (lTok: TokenType, rTok: TokenType, foldStyle: boolean | undefined, fn: () => void) => {
    let isEmpty = true;

    pushToken(lTok);

    onTokenPush = tok => {
      isEmpty = false;

      const effectiveFoldStyle = typeof foldStyle !== `undefined`
        ? foldStyle
        : tok !== TokenType.L_BRACKET && tok !== TokenType.L_CURLY;

      if (effectiveFoldStyle) {
        pushToken(TokenType.NL);
        indentCount += 1;
        isInlineContext.push(false);
      } else {
        isInlineContext.push(true);
      }
    };

    fn();

    onTokenPush = null;

    if (!isEmpty) {
      const hasIndent = !isInlineContext.pop();
      if (hasIndent) {
        indentCount -= 1;
      }
    }

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

  const triggerPushFn = (token?: TokenType) => {
    const onTokenPushFn = onTokenPush;
    onTokenPush = null;

    onTokenPushFn?.(token);
  };

  const pushReference = (node: any) => {
    triggerPushFn();

    const style = {...styleByType.get(`attr-name`), ...extraTheme.identifier};
    const line = getIndentedLine();

    const propertyName = node.$ref.replace(`#/properties/`, ``);
    const target = data.properties[propertyName];

    line.push(
      <React.Fragment key={line.length}>
        <span style={{color: `#ffffff`}}>
          See
        </span>
        {` `}
        <Link href={`#${propertyName}`} style={style}>
          {propertyName}
        </Link>
      </React.Fragment>,
    );
  };

  const pushIdentifier = (name: string) => {
    triggerPushFn();

    const id = getCurrentId();
    const style = {...styleByType.get(`attr-name`), ...extraTheme.identifier};
    const line = getIndentedLine();

    line.push(
      <Link key={line.length} href={`#${id}`}>
        <span style={style}>
          {name}
        </span>
      </Link>,
    );
  };

  const pushString = (str: string) => {
    triggerPushFn();

    const style = styleByType.get(`string`);
    const line = getIndentedLine();

    line.push(
      <span key={line.length} style={style}>
        {JSON.stringify(str)}
      </span>,
    );
  };

  const pushNull = (val: number) => {
    triggerPushFn();

    const style = styleByType.get(`null`);
    const line = getIndentedLine();

    line.push(
      <span key={line.length} style={style}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushNumber = (val: number) => {
    triggerPushFn();

    const style = styleByType.get(`number`);
    const line = getIndentedLine();

    line.push(
      <span key={line.length} style={style}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushBoolean = (val: boolean) => {
    triggerPushFn();

    const style = styleByType.get(`keyword`);
    const line = getIndentedLine();

    line.push(
      <span key={line.length} style={style}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushSyntaxToken = (raw: string) => {
    triggerPushFn();

    const style = styleByType.get(`punctuation`);
    const line = getIndentedLine();

    line.push(
      <span key={line.length} style={style}>
        {raw}
      </span>,
    );
  };

  const pushToken = (token: TokenType) => {
    triggerPushFn(token);

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

      case TokenType.PIPE: {
        pushSyntaxToken(`|`);
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
        process(spec, {skipIndent: false});
        return;
      }
    }

    pushIdentifier(`error`);
  };

  const forwardExample = (node: any, example: any) => {
    const exampleObject = node.type === `array`
      ? {exampleItems: example}
      : {examples: [example]};

    return {
      ...node,
      ...exampleObject,
    };
  };

  const getExample = (node: any) => {
    const example = typeof node.examples?.[0] !== `undefined`
      ? node.examples[0]
      : node.default;

    if (typeof example === `undefined`)
      throw new Error(`Missing example (in ${idSegments.join(`.`)})`);

    return example;
  };

  const getDescription = (node: any) => {
    const title = node.title ?? ``;
    const description = node.description ?? ``;

    return `${title}\n\n${description}`.trim();
  };

  const pushByType = {
    null: pushNull,
    number: pushNumber,
    boolean: pushBoolean,
    string: pushString,
  };

  const pushTyped = (value: any) => {
    const valueType = value !== null
      ? typeof value
      : `null`;

    if (!Object.prototype.hasOwnProperty.call(pushByType, valueType))
      throw new Error(`Unsupported type ${valueType} (in ${idSegments.join(`.`)})`);

    const pushFn: (arg: any) => void
      = pushByType[valueType as keyof typeof pushByType];

    return pushFn(value);
  };

  const process = (node: any, {skipIndent}: {skipIndent: boolean}) => {
    if (Array.isArray(node.type) && !node.type.every((type: string) => Object.prototype.hasOwnProperty.call(pushByType, type)))
      throw new Error(`Unsupported type ${node.type.join(`, `)} (in ${idSegments.join(`.`)})`);

    const type = Array.isArray(node.type)
      ? `mixed`
      : node.type;

    switch (type) {
      case `null`:
      case `number`:
      case `boolean`:
      case `string`:
      case `mixed`: {
        if (typeof node.enum === `undefined`) {
          pushTyped(getExample(node));
        } else {
          pushTyped(node.enum[0]);
          for (let t = 1; t < node.enum.length; ++t) {
            pushToken(TokenType.SPACE);
            pushToken(TokenType.PIPE);
            pushToken(TokenType.SPACE);
            pushTyped(node.enum[t]);
          }
        }
      } break;

      case `array`: {
        indentedBlock(TokenType.L_BRACKET, TokenType.R_BRACKET, node.foldStyle, () => {
          const exampleItems = node.exampleItems ?? node._exampleItems ?? node.default ?? [];

          for (let t = 0; t < exampleItems.length; ++t) {
            const itemNode = node.prefixItems && t < node.prefixItems.length
              ? node.prefixItems[t]
              : node.items;

            process(forwardExample(itemNode, exampleItems[t]), {
              skipIndent: false,
            });

            if (isInlineContext[isInlineContext.length - 1]) {
              if (t + 1 < exampleItems.length) {
                pushToken(TokenType.COMMA);
                pushToken(TokenType.SPACE);
              }
            } else {
              pushToken(TokenType.COMMA);
              pushToken(TokenType.NL);
            }
          }
        });
      } break;

      case `object`: {
        const injectObject = () => {
          const exampleKeys = node.exampleKeys ?? node._exampleKeys;
          if (typeof exampleKeys !== `undefined`) {
            if (typeof node.patternProperties === `undefined`)
              throw new Error(`Using exampleKeys without patternProperties is not supported (in ${idSegments.join(`.`)})`);

            for (const exampleKey of exampleKeys) {
              pushIdentifier(exampleKey);
              pushToken(TokenType.COLON);
              pushToken(TokenType.SPACE);

              processPattern(node.patternProperties, exampleKey);

              pushToken(TokenType.COMMA);
              pushToken(TokenType.NL);
            }
          } else {
            const entries = Object.entries<any>(node.properties);

            for (let t = 0; t < entries.length; ++t) {
              const [propertyName, propertyNode] = entries[t];

              // If there's an example and it doesn't include this key, we can omit it
              if (node.examples?.[0] && typeof node.examples[0][propertyName] === `undefined`)
                continue;

              idSegments.push(propertyName);

              const description = getDescription(propertyNode);
              if (description)
                startNewSection(<JsonSchemaAnnotation extraTheme={extraTheme} children={descriptionRenderer.render(description)}/>);

              pushIdentifier(propertyName);
              pushToken(TokenType.COLON);
              pushToken(TokenType.SPACE);

              const examples = node.examples
                ? forwardExample(propertyNode, node.examples[0][propertyName])
                : {};

              process({...propertyNode, ...examples}, {
                skipIndent: false,
              });

              if (isInlineContext[isInlineContext.length - 1]) {
                if (t + 1 < entries.length) {
                  pushToken(TokenType.COMMA);
                  pushToken(TokenType.SPACE);
                }
              } else {
                pushToken(TokenType.COMMA);
                pushToken(TokenType.NL);
              }

              idSegments.pop();

              if (description) {
                closeSection();
              }
            }
          }
        };

        if (skipIndent) {
          injectObject();
        } else {
          indentedBlock(TokenType.L_CURLY, TokenType.R_CURLY, node.foldStyle, injectObject);
        }
      } break;

      default: {
        if (typeof node.$ref !== `undefined`) {
          pushReference(node);
          return;
        }

        throw new Error(`Unsupported type ${type} (in ${idSegments.join(`.`)})`);
      } break;
    }
  };

  process(data, {
    skipIndent: skipFirstIndent,
  });

  return (
    <div className={`rjd-container`} style={{padding: `1rem 2rem`, paddingTop: sections[0].header ? `1rem` : `2rem`, whiteSpace: `pre`, ...theme.plain, ...extraTheme.container}}>
      {sections.map(({id, header, lines}, index) => {
        const sectionIndent = Math.min(...lines.filter(line => {
          return line.tokens.length > 0;
        }).map(line => {
          return line.indent;
        }));

        let sectionRender: React.ReactNode = lines.map(({indent, tokens}, lineIndex) => (
          <div key={lineIndex} style={{marginLeft: (indent - sectionIndent) * indentSize, whiteSpace: `nowrap`, textOverflow: `ellipsis`, overflow: `hidden`, ...extraTheme.section}}>
            {tokens}
          </div>
        ));

        if (header) {
          sectionRender = (
            <div style={{position: `relative`, margin: `1rem -1rem`, padding: `1rem`, ...id === activeId ? extraTheme.activeHeader : extraTheme.inactiveHeader}}>
              <h3 id={id ?? undefined} style={{position: `absolute`, display: `block`, marginTop: `-2rem`, width: `100%`, fontSize: 0, userSelect: `none`, ...extraTheme.anchor}} children={id}/>
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
