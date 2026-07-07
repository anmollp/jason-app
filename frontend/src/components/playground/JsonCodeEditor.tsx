"use client";

import { json } from "@codemirror/lang-json";
import {
  HighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

type LineHighlight = {
  line: number;
  tone: "add" | "remove" | "change";
};

type JsonCodeEditorProps = {
  ariaLabel: string;
  errorLine?: number;
  highlightedLines?: LineHighlight[];
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  shouldWrapLines?: boolean;
  showLineNumbers?: boolean;
  tone?: "default" | "error";
  value: string;
};

const emptyHighlightedLines: LineHighlight[] = [];

const lineHighlightClassNames = {
  add: "cm-jason-line-add",
  change: "cm-jason-line-change",
  remove: "cm-jason-line-remove",
};

function buildLineDecorations(
  view: EditorView,
  errorLine?: number,
  highlightedLines: LineHighlight[] = [],
) {
  const decorations = highlightedLines.flatMap((highlight) => {
    if (highlight.line < 1 || highlight.line > view.state.doc.lines) {
      return [];
    }

    const line = view.state.doc.line(highlight.line);
    const className = lineHighlightClassNames[highlight.tone];

    return [
      Decoration.line({
        attributes: {
          class: className,
        },
      }).range(line.from),
      Decoration.widget({
        block: false,
        side: -1,
        widget: new LineMarkerWidget(className),
      }).range(line.from),
    ];
  });

  if (errorLine && errorLine >= 1 && errorLine <= view.state.doc.lines) {
    const line = view.state.doc.line(errorLine);

    decorations.push(
      Decoration.line({
        attributes: {
          class: "cm-jason-line-error",
        },
      }).range(line.from),
      Decoration.widget({
        block: false,
        side: -1,
        widget: new LineMarkerWidget("cm-jason-line-error"),
      }).range(line.from),
    );
  }

  return Decoration.set(decorations, true);
}

class LineMarkerWidget extends WidgetType {
  private readonly className: string;

  constructor(className: string) {
    super();
    this.className = className;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-jason-line-marker ${this.className}`;
    return marker;
  }
}

function lineDecorationPlugin(
  errorLine?: number,
  highlightedLines: LineHighlight[] = [],
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildLineDecorations(view, errorLine, highlightedLines);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildLineDecorations(
            update.view,
            errorLine,
            highlightedLines,
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

const jasonHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    {
      color: "#A1A1AA",
      tag: tags.punctuation,
    },
    {
      color: "#34D399",
      tag: tags.string,
    },
    {
      color: "#A78BFA",
      tag: tags.number,
    },
    {
      color: "#60A5FA",
      tag: tags.bool,
    },
    {
      color: "#F87171",
      tag: tags.null,
    },
    {
      color: "#FBBF24",
      tag: tags.propertyName,
    },
  ]),
);

const noOpExtension: Extension = [];

const lineGutterExtension: Extension = [
  lineNumbers(),
  foldGutter(),
];

const jasonEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "#D4D4D8",
    fontFamily:
      "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "14px",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "#22D3EE",
    cursor: "text",
    minHeight: "330px",
    padding: "0 0 0 16px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#22D3EE !important",
    borderLeftWidth: "2px",
  },
  ".cm-editor": {
    height: "100%",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid #27272A",
    color: "#52525B",
    minHeight: "330px",
  },
  ".cm-line": {
    cursor: "text",
    lineHeight: "24px",
    padding: "0 8px 0 0",
    position: "relative",
  },
  ".cm-line.cm-activeLine": {
    backgroundColor: "rgba(39, 39, 42, 0.48)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "#A1A1AA",
  },
  ".cm-foldGutter": {
    display: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(16, 185, 129, 0.24) !important",
  },
  ".cm-jason-line-add": {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  ".cm-jason-line-change": {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  ".cm-jason-line-error": {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  ".cm-jason-line-marker": {
    bottom: "2px",
    left: "2px",
    position: "absolute",
    top: "2px",
    width: "2px",
  },
  ".cm-jason-line-marker.cm-jason-line-add": {
    backgroundColor: "#34D399",
  },
  ".cm-jason-line-marker.cm-jason-line-change": {
    backgroundColor: "#FBBF24",
  },
  ".cm-jason-line-marker.cm-jason-line-error": {
    backgroundColor: "#F87171",
  },
  ".cm-jason-line-marker.cm-jason-line-remove": {
    backgroundColor: "#F87171",
  },
  ".cm-jason-line-remove": {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  ".cm-placeholder": {
    color: "#52525B",
  },
});

export function JsonCodeEditor({
  ariaLabel,
  errorLine,
  highlightedLines = emptyHighlightedLines,
  onChange,
  onSubmit,
  readOnly = false,
  shouldWrapLines = true,
  showLineNumbers = true,
  tone = "default",
  value,
}: JsonCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestValueRef = useRef(value);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const extensions: Extension[] = [
      showLineNumbers ? lineGutterExtension : noOpExtension,
      history(),
      drawSelection(),
      indentOnInput(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      json(),
      jasonHighlightStyle,
      jasonEditorTheme,
      tone === "error"
        ? EditorView.theme({
            "&": {
              color: "#F87171",
            },
          })
        : noOpExtension,
      placeholder("Paste JSON here..."),
      lineDecorationPlugin(errorLine, highlightedLines),
      readOnly ? EditorView.editable.of(false) : noOpExtension,
      EditorState.readOnly.of(readOnly),
      shouldWrapLines ? EditorView.lineWrapping : noOpExtension,
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
      keymap.of([
        readOnly
          ? []
          : [
              {
                key: "Mod-Enter",
                run: () => {
                  onSubmitRef.current?.();
                  return true;
                },
              },
              indentWithTab,
            ],
        ...defaultKeymap,
        ...historyKeymap,
      ].flat()),
    ];

    const view = new EditorView({
      doc: latestValueRef.current,
      extensions,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    ariaLabel,
    errorLine,
    highlightedLines,
    readOnly,
    shouldWrapLines,
    showLineNumbers,
    tone,
  ]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view || view.state.doc.toString() === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: view.state.doc.length,
      },
    });
  }, [value]);

  return <div ref={containerRef} className="h-full min-h-[330px]" />;
}
