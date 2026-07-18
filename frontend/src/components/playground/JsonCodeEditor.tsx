"use client";

import { json } from "@codemirror/lang-json";
import {
  HighlightStyle,
  codeFolding,
  foldGutter,
  foldKeymap,
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
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import {
  jsonPointerAtPosition,
  selectionPointerPosition,
} from "./json-selection";
import {
  SelectionActionOverlay,
  selectionActionDecorations,
  selectionActionTheme,
  type SelectionAction,
  useJsonSelectionActions,
} from "./JsonSelectionActions";

type LineHighlight = {
  line: number;
  tone: "add" | "remove" | "change";
};

type JsonCodeEditorProps = {
  ariaLabel: string;
  enableFolding?: boolean;
  errorLine?: number;
  highlightedLines?: LineHighlight[];
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: {
    line: number;
    path: string;
  }) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  selectionAction?: SelectionAction;
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
  selectionAction?: SelectionAction,
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

  decorations.push(...selectionActionDecorations(view, selectionAction));

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
  selectionActionRef?: RefObject<SelectionAction | undefined>,
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildLineDecorations(
          view,
          errorLine,
          highlightedLines,
          selectionActionRef?.current,
        );
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.transactions.length) {
          this.decorations = buildLineDecorations(
            update.view,
            errorLine,
            highlightedLines,
            selectionActionRef?.current,
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

function createFoldMarker(isOpen: boolean) {
  const marker = document.createElement("span");
  marker.textContent = isOpen ? "-" : "+";
  marker.setAttribute("aria-hidden", "true");
  marker.className = "cm-jason-fold-marker";
  return marker;
}

const jasonEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "#D4D4D8",
    fontFamily:
      "var(--font-jason-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "14px",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "#22D3EE",
    cursor: "text",
    minHeight: "300px",
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
    minHeight: "300px",
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
    color: "#71717A",
    minWidth: "18px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
  },
  ".cm-jason-fold-marker": {
    alignItems: "center",
    border: "1px solid #3F3F46",
    borderRadius: "4px",
    color: "#A1A1AA",
    display: "inline-flex",
    fontSize: "12px",
    fontWeight: "700",
    height: "15px",
    justifyContent: "center",
    lineHeight: "15px",
    width: "15px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "rgba(39, 39, 42, 0.92)",
    border: "1px solid #3F3F46",
    borderRadius: "6px",
    color: "#A1A1AA",
    cursor: "pointer",
    margin: "0 4px",
    padding: "0 6px",
  },
  ".cm-scroller": {
    overflow: "auto",
    scrollbarColor: "#71717A #18181B",
    scrollbarWidth: "thin",
  },
  ".cm-scroller::-webkit-scrollbar": {
    height: "10px",
    width: "10px",
  },
  ".cm-scroller::-webkit-scrollbar-track": {
    backgroundColor: "#18181B",
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    backgroundClip: "content-box",
    backgroundColor: "#71717A",
    border: "2px solid #18181B",
    borderRadius: "999px",
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "#A1A1AA",
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
  enableFolding = false,
  errorLine,
  highlightedLines = emptyHighlightedLines,
  onChange,
  onSelectionChange,
  onSubmit,
  readOnly = false,
  selectionAction,
  shouldWrapLines = true,
  showLineNumbers = true,
  tone = "default",
  value,
}: JsonCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestValueRef = useRef(value);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onSubmitRef = useRef(onSubmit);
  const { anchor: selectionAnchor, selectionActionRef } =
    useJsonSelectionActions(viewRef, containerRef, selectionAction);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

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
      showLineNumbers ? lineNumbers() : noOpExtension,
      enableFolding
        ? foldGutter({
            markerDOM: createFoldMarker,
          })
        : noOpExtension,
      history(),
      drawSelection(),
      indentOnInput(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      json(),
      enableFolding
        ? codeFolding({
            placeholderText: "...",
          })
        : noOpExtension,
      jasonHighlightStyle,
      jasonEditorTheme,
      selectionActionTheme,
      tone === "error"
        ? EditorView.theme({
            "&": {
              color: "#F87171",
            },
          })
        : noOpExtension,
      placeholder("Paste JSON here..."),
      lineDecorationPlugin(errorLine, highlightedLines, selectionActionRef),
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

        if (update.selectionSet) {
          const position = selectionPointerPosition(update.state);
          const line = update.state.doc.lineAt(position);

          onSelectionChangeRef.current?.({
            line: line.number,
            path: jsonPointerAtPosition(update.state, position),
          });
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
        ...(enableFolding ? foldKeymap : []),
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
    enableFolding,
    errorLine,
    highlightedLines,
    readOnly,
    selectionActionRef,
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

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div ref={containerRef} className="h-full min-h-0" />
      {selectionAction?.isOpen && selectionAnchor ? (
        <SelectionActionOverlay action={selectionAction} anchor={selectionAnchor} />
      ) : null}
    </div>
  );
}
