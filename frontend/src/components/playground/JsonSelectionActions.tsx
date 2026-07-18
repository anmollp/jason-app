"use client";

import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type SelectionAction = {
  isOpen: boolean;
  line: number;
  onToggle: () => void;
  options: Array<{
    label: string;
    onSelect: () => void;
    tone: "add" | "copy" | "move" | "remove" | "replace" | "test";
  }>;
  path: string;
};

type SelectionActionAnchor = {
  left: number;
  top: number;
  width: number;
};

const overlayEdgeInset = 8;
const overlayGap = 6;
const overlayReservedHeight = 120;

const optionClassNames = {
  add: "border-emerald-400/70 text-emerald-300 hover:bg-emerald-500/10",
  copy: "border-violet-400/70 text-violet-300 hover:bg-violet-500/10",
  move: "border-blue-400/70 text-blue-300 hover:bg-blue-500/10",
  remove: "border-red-400/70 text-red-300 hover:bg-red-500/10",
  replace: "border-amber-400/70 text-amber-300 hover:bg-amber-500/10",
  test: "border-cyan-400/70 text-cyan-300 hover:bg-cyan-500/10",
} satisfies Record<SelectionAction["options"][number]["tone"], string>;

class SelectionActionTriggerWidget extends WidgetType {
  constructor(private readonly action: SelectionAction) {
    super();
  }

  eq() {
    return false;
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-jason-selection-action";

    const button = document.createElement("button");
    button.className = `cm-jason-selection-action-trigger${
      this.action.isOpen ? " cm-jason-selection-action-trigger-open" : ""
    }`;
    button.type = "button";
    button.textContent = this.action.isOpen ? "×" : "+";
    button.setAttribute(
      "aria-label",
      this.action.isOpen
        ? "Close JSON Patch operations"
        : "Open JSON Patch operations",
    );
    button.title = this.action.isOpen ? "Close operations" : "Patch this selection";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.action.onToggle();
    });
    wrapper.appendChild(button);

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

export function selectionActionDecorations(
  view: EditorView,
  action?: SelectionAction,
) {
  if (!action || action.line < 1 || action.line > view.state.doc.lines) {
    return [];
  }

  const line = view.state.doc.line(action.line);

  return [
    Decoration.line({
      attributes: { class: "cm-jason-line-selected-action" },
    }).range(line.from),
    Decoration.widget({
      block: false,
      side: 1,
      widget: new SelectionActionTriggerWidget(action),
    }).range(line.to),
  ];
}

export const selectionActionTheme = EditorView.theme({
  ".cm-content.cm-jason-selection-overlay-open": {
    paddingBottom: `${overlayReservedHeight}px`,
  },
  ".cm-jason-line-selected-action": {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    paddingRight: "40px",
  },
  ".cm-jason-selection-action": {
    display: "inline-flex",
    marginLeft: "0",
    position: "absolute",
    right: "8px",
    top: "1px",
    verticalAlign: "top",
    zIndex: "5",
  },
  ".cm-jason-selection-action-trigger": {
    alignItems: "center",
    backgroundColor: "#082F49",
    border: "1px solid rgba(56, 189, 248, 0.75)",
    borderRadius: "7px",
    color: "#7DD3FC",
    cursor: "pointer",
    display: "inline-flex",
    fontFamily:
      "var(--font-jason-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    fontWeight: "800",
    height: "22px",
    justifyContent: "center",
    lineHeight: "20px",
    padding: "0",
    transition: "border-color 120ms ease, color 120ms ease, transform 120ms ease",
    width: "22px",
  },
  ".cm-jason-selection-action-trigger:hover": {
    borderColor: "#BAE6FD",
    color: "#E0F2FE",
    transform: "translateY(-1px)",
  },
  ".cm-jason-selection-action-trigger-open": {
    backgroundColor: "#450A0A",
    borderColor: "rgba(248, 113, 113, 0.82)",
    color: "#FCA5A5",
  },
  ".cm-jason-selection-action-trigger-open:hover": {
    borderColor: "#FECACA",
    color: "#FEE2E2",
  },
});

export function SelectionActionOverlay({
  action,
  anchor,
}: {
  action: SelectionAction;
  anchor: SelectionActionAnchor;
}) {
  return (
    <div
      className="absolute z-50 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/35"
      style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
    >
      <div className="border-b border-zinc-700/80 px-2 py-2 text-center">
        <span
          className="block truncate font-mono text-[11px] font-bold text-sky-300"
          title={action.path}
        >
          {action.path}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {action.options.map((option) => (
          <button
            key={option.tone}
            className={`h-7 min-w-0 cursor-pointer rounded-md border bg-zinc-950/80 px-1.5 font-mono text-[11px] font-bold transition hover:-translate-y-0.5 ${optionClassNames[option.tone]}`}
            type="button"
            onClick={option.onSelect}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function selectionLineCoords(view: EditorView, action: SelectionAction) {
  if (action.line < 1 || action.line > view.state.doc.lines) {
    return null;
  }

  const line = view.state.doc.line(action.line);

  return view.coordsAtPos(line.from) ?? view.coordsAtPos(line.to);
}

function selectionActionAnchor(
  view: EditorView,
  action: SelectionAction,
  editorElement: HTMLElement,
): SelectionActionAnchor | null {
  const lineCoords = selectionLineCoords(view, action);

  if (!lineCoords) {
    return null;
  }

  const scrollerRect = view.scrollDOM.getBoundingClientRect();

  if (
    lineCoords.bottom < scrollerRect.top ||
    lineCoords.top > scrollerRect.bottom
  ) {
    return null;
  }

  const editorRect = editorElement.getBoundingClientRect();
  const availableWidth = Math.max(0, scrollerRect.width - overlayEdgeInset * 2);
  const width = Math.min(304, availableWidth);
  const scrollerLeft = scrollerRect.left - editorRect.left + overlayEdgeInset;
  const scrollerRight = scrollerRect.right - editorRect.left - overlayEdgeInset;
  const preferredLeft = lineCoords.left - editorRect.left - overlayEdgeInset;

  return {
    left: Math.max(
      scrollerLeft,
      Math.min(preferredLeft, scrollerRight - width),
    ),
    top: lineCoords.bottom - editorRect.top + overlayGap,
    width,
  };
}

function makeRoomForSelectionOverlay(view: EditorView, action: SelectionAction) {
  const lineCoords = selectionLineCoords(view, action);

  if (!lineCoords) {
    return;
  }

  const scrollerBottom = view.scrollDOM.getBoundingClientRect().bottom;
  const overflow =
    lineCoords.bottom +
    overlayGap +
    overlayReservedHeight +
    overlayEdgeInset -
    scrollerBottom;

  if (overflow > 0) {
    view.scrollDOM.scrollTop += overflow;
  }
}

export function useJsonSelectionActions(
  viewRef: RefObject<EditorView | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  selectionAction?: SelectionAction,
) {
  const selectionActionRef = useRef(selectionAction);
  const [anchor, setAnchor] = useState<SelectionActionAnchor | null>(null);

  const updateAnchor = useCallback(() => {
    const view = viewRef.current;
    const action = selectionActionRef.current;
    const editorElement = containerRef.current;

    setAnchor(
      view && action?.isOpen && editorElement
        ? selectionActionAnchor(view, action, editorElement)
        : null,
    );
  }, [containerRef, viewRef]);

  useEffect(() => {
    selectionActionRef.current = selectionAction;
    viewRef.current?.dispatch({});
  }, [selectionAction, viewRef]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.contentDOM.classList.toggle(
      "cm-jason-selection-overlay-open",
      Boolean(selectionAction?.isOpen),
    );

    if (!selectionAction?.isOpen) {
      const clearFrame = window.requestAnimationFrame(() => setAnchor(null));

      return () => window.cancelAnimationFrame(clearFrame);
    }

    let placementFrame = 0;
    const scrollFrame = window.requestAnimationFrame(() => {
      const action = selectionActionRef.current;

      if (!action?.isOpen) {
        return;
      }

      makeRoomForSelectionOverlay(view, action);
      placementFrame = window.requestAnimationFrame(updateAnchor);
    });

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(placementFrame);
    };
  }, [selectionAction?.isOpen, selectionAction?.line, updateAnchor, viewRef]);

  useEffect(() => {
    if (!selectionAction?.isOpen) {
      return;
    }

    const scroller = viewRef.current?.scrollDOM;
    const handlePlacementChange = () => updateAnchor();

    updateAnchor();
    scroller?.addEventListener("scroll", handlePlacementChange);
    window.addEventListener("resize", handlePlacementChange);

    return () => {
      scroller?.removeEventListener("scroll", handlePlacementChange);
      window.removeEventListener("resize", handlePlacementChange);
    };
  }, [selectionAction?.isOpen, updateAnchor, viewRef]);

  return { anchor, selectionActionRef };
}
