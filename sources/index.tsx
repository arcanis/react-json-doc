import React from 'react';

export const defaultClassNames = {
  container: `bg-gray-900 p-4 text-white whitespace-pre font-mononoki`,
  header: (opts: {active: boolean}) => `relative my-4 rounded ${opts.active ? `bg-blue-900` : ``} p-4`,
  anchor: `absolute -mt-8 w-full`,
  section: `-mt-4`,

  annotation: `mb-4 p-4 bg-gray-800 rounded text-gray-100 font-sans whitespace-normal`,
  identifier: `underline`,
  string: `text-green-400`,
  number: `text-yellow-400`,
  boolean: `text-blue-300`,
  syntax: `text-gray-500`,
};

export type JsonSchemaClassNames = typeof defaultClassNames;

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

function JsonSchemaAnnotation({classNames, children}: {classNames: JsonSchemaClassNames, children: React.ReactNode}) {
  return (
    <div className={classNames.annotation}>
      {children}
    </div>
  );
}

function getCurrentHash() {
  return window.location.hash.slice(1);
}

export function JsonSchemaDocumentation({
  classNames = defaultClassNames,
  linkComponent: Link,
  data,
}: {
  classNames: JsonSchemaClassNames;
  linkComponent: React.ComponentType<{href: string}>;
  data: any;
}) {
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

    getIndentedLine().push(
      <Link href={`#${id}`}>
        <a className={classNames.identifier}>
          {name}
        </a>
      </Link>,
    );
  };

  const pushString = (str: string) => {
    getIndentedLine().push(
      <span className={classNames.string}>
        {JSON.stringify(str)}
      </span>,
    );
  };

  const pushNumber = (val: number) => {
    getIndentedLine().push(
      <span className={classNames.number}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushBoolean = (val: boolean) => {
    getIndentedLine().push(
      <span className={classNames.boolean}>
        {JSON.stringify(val)}
      </span>,
    );
  };

  const pushSyntaxToken = (raw: string) => {
    getIndentedLine().push(
      <span className={classNames.syntax}>
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
                startNewSection(<JsonSchemaAnnotation classNames={classNames} children={propertyNode.description}/>);

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
    <div className={classNames.container}>
      {sections.map(({id, header, lines}, index) => {
        const sectionIndent = Math.min(...lines.filter(line => {
          return line.tokens.length > 0;
        }).map(line => {
          return line.indent;
        }));

        let sectionRender: React.ReactNode = lines.map(({indent, tokens}, lineIndex) => (
          <div key={lineIndex} style={{marginLeft: (indent - sectionIndent) * indentSize}}>
            {tokens}
          </div>
        ));

        if (header) {
          sectionRender = (
            <div key={index} className={classNames.header({active: activeId === id})}>
              <div id={id ?? undefined} className={classNames.anchor}/>
              {header}
              {sectionRender}
            </div>
          );
        }

        return (
          <div key={index} className={classNames.section} style={{marginLeft: sectionIndent * indentSize}}>
            {sectionRender}
          </div>
        );
      })}
    </div>
  );
}
