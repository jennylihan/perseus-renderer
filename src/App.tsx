import * as React from "react";

import {PerseusItemRenderer} from "./PerseusItemRenderer";
import {Sidebar} from "./Sidebar";

import type {PerseusItem} from "@khanacademy/perseus-core";

// An item plus an optional human-readable label to show in its card header,
// and an optional group (e.g. an exercise's problem type) used to section the
// sidebar.
// `raw` is the item JSON exactly as loaded, before normalize() adds
// defaults, so the copy buttons round-trip to the source.
type LabeledItem = {
    item: PerseusItem;
    raw: any;
    label?: string;
    group?: string;
};

// Accepts either a full PerseusItem ({question, hints, answerArea}) or a bare
// PerseusRenderer ({content, widgets, images}) and normalizes to a PerseusItem.
function normalize(parsed: any): PerseusItem {
    if (parsed && parsed.question) {
        return {
            answerArea: parsed.answerArea ?? null,
            hints: parsed.hints ?? [],
            itemDataVersion: parsed.itemDataVersion ?? {major: 0, minor: 1},
            ...parsed,
        };
    }
    // Treat the input as a bare renderer (just the "question" part).
    return {
        question: parsed,
        answerArea: null,
        hints: [],
        itemDataVersion: {major: 0, minor: 1},
    };
}

// A Khan Academy exercise export wraps the Perseus items in a top-level
// `items` array, where each entry carries the actual item under `item_data`
// (and a friendly `name`). Detect that shape.
function isExerciseExport(parsed: any): boolean {
    return (
        parsed &&
        Array.isArray(parsed.items) &&
        parsed.items.some((it: any) => it && it.item_data)
    );
}

// Another export shape is a list of exercises (problem types), each carrying
// its items under `assessmentItems` with the Perseus item JSON-encoded as a
// string in `itemData`:
//   [{problemType, contentId, assessmentItems: [{contentId, itemData}]}]
function isAssessmentItemsExport(entry: any): boolean {
    return entry && Array.isArray(entry.assessmentItems);
}

// Flatten one exercise entry into labeled items, one per assessment item,
// grouped under the exercise's problem type. `itemData` may be a JSON string
// or an already-parsed object.
function flattenExercise(entry: any): LabeledItem[] {
    const group =
        typeof entry.problemType === "string" ? entry.problemType : undefined;
    return entry.assessmentItems
        .filter((ai: any) => ai && ai.itemData)
        .map((ai: any) => {
            const data =
                typeof ai.itemData === "string"
                    ? JSON.parse(ai.itemData)
                    : ai.itemData;
            return {item: normalize(data), raw: data, group};
        });
}

// A file may contain: a full KA exercise export, a list of exercises with
// `assessmentItems`, a single item, or an array of items. Normalize any of
// those into a list of labeled items.
function toItems(parsed: any): LabeledItem[] {
    if (isExerciseExport(parsed)) {
        return parsed.items
            .filter((it: any) => it && it.item_data)
            .map((it: any) => ({
                item: normalize(it.item_data),
                raw: it.item_data,
                label: it.name,
            }));
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.flatMap((p) =>
        isAssessmentItemsExport(p)
            ? flattenExercise(p)
            : [{item: normalize(p), raw: p}],
    );
}

export function App(): React.ReactElement {
    const [items, setItems] = React.useState<LabeledItem[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [fileName, setFileName] = React.useState<string | null>(null);
    // Bumped on every load so each renderer resets its transient state.
    const [loadKey, setLoadKey] = React.useState(0);
    // Which copy button most recently succeeded, so we can flash "Copied!".
    const [copied, setCopied] = React.useState<string | null>(null);
    // The paste panel: whether it's open, and its current contents.
    const [pasteOpen, setPasteOpen] = React.useState(false);
    const [pasteText, setPasteText] = React.useState("");
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const pasteRef = React.useRef<HTMLTextAreaElement>(null);
    const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
    const getCard = React.useCallback(
        (i: number) => cardRefs.current[i] ?? null,
        [],
    );

    const loadJson = React.useCallback((raw: string, name: string) => {
        try {
            const parsed = JSON.parse(raw);
            const parsedItems = toItems(parsed);
            if (parsedItems.length === 0) {
                setError("That JSON did not contain any Perseus items.");
                return;
            }
            setItems(parsedItems);
            setFileName(name);
            setError(null);
            setLoadKey((k) => k + 1);
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
        }
    }, []);

    // navigator.clipboard needs a secure context and permission; localhost
    // usually counts, but fall back to a hidden textarea + execCommand so this
    // also works over plain http on a LAN address or when the API rejects.
    const copyText = React.useCallback((text: string, tag: string) => {
        const flash = () => {
            setCopied(tag);
            window.setTimeout(() => setCopied(null), 1500);
        };
        const legacyCopy = () => {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try {
                if (document.execCommand("copy")) {
                    flash();
                } else {
                    setError("Could not copy to the clipboard.");
                }
            } catch {
                setError("Could not copy to the clipboard.");
            } finally {
                document.body.removeChild(ta);
            }
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(flash, legacyCopy);
            return;
        }
        legacyCopy();
    }, []);

    const handleFile = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = () => loadJson(String(reader.result), file.name);
            reader.onerror = () =>
                setError(`Could not read file: ${file.name}`);
            reader.readAsText(file);
        },
        [loadJson],
    );

    const loadSample = React.useCallback(() => {
        fetch("items.json")
            .then((r) => r.text())
            .then((raw) => loadJson(raw, "items.json (sample)"))
            .catch((e) => setError(`Could not load sample: ${e.message}`));
    }, [loadJson]);

    // Load the bundled sample on first mount so the grid isn't empty.
    React.useEffect(() => {
        loadSample();
    }, [loadSample]);

    return (
        <>
            <Sidebar entries={items} getCard={getCard} />
            <div className="app">
                <header className="app-header">
                    <h1>Perseus Renderer</h1>
                    <p>
                        Load a <code>.json</code> file containing a Perseus
                        item, an array of items, or an exercise export, and
                        interact with them below.
                    </p>
                </header>

                <div className="toolbar">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Choose .json file…
                    </button>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => {
                            setPasteOpen((open) => !open);
                            // Focus after the panel actually exists.
                            window.setTimeout(
                                () => pasteRef.current?.focus(),
                                0,
                            );
                        }}
                    >
                        {pasteOpen ? "Hide paste box" : "Paste JSON…"}
                    </button>
                    <button type="button" className="btn" onClick={loadSample}>
                        Load sample
                    </button>
                    <button
                        type="button"
                        className="btn"
                        disabled={items.length === 0}
                        onClick={() =>
                            copyText(
                                JSON.stringify(
                                    items.map((it) => it.raw),
                                    null,
                                    2,
                                ),
                                "all",
                            )
                        }
                    >
                        {copied === "all" ? "Copied!" : "Copy all JSON"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFile}
                        style={{display: "none"}}
                    />
                    {fileName && (
                        <span className="file-name">
                            {fileName} — {items.length}{" "}
                            {items.length === 1 ? "item" : "items"}
                        </span>
                    )}
                </div>

                {pasteOpen && (
                    <div className="paste-panel">
                        <textarea
                            ref={pasteRef}
                            className="paste-box"
                            value={pasteText}
                            placeholder={
                                "Paste Perseus JSON here — a single item, an array of items, " +
                                "an exercise export, or exercise objects with " +
                                "assessmentItems[].itemData.\n\n" +
                                "Press ⌘/Ctrl+Enter to render."
                            }
                            spellCheck={false}
                            onChange={(e) => setPasteText(e.target.value)}
                            onKeyDown={(e) => {
                                if (
                                    e.key === "Enter" &&
                                    (e.metaKey || e.ctrlKey) &&
                                    pasteText.trim()
                                ) {
                                    e.preventDefault();
                                    loadJson(pasteText, "pasted JSON");
                                }
                            }}
                        />
                        <div className="paste-actions">
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!pasteText.trim()}
                                onClick={() =>
                                    loadJson(pasteText, "pasted JSON")
                                }
                            >
                                Render pasted JSON
                            </button>
                            <button
                                type="button"
                                className="btn"
                                disabled={!pasteText}
                                onClick={() => {
                                    setPasteText("");
                                    pasteRef.current?.focus();
                                }}
                            >
                                Clear
                            </button>
                            <span className="paste-hint">
                                ⌘/Ctrl+Enter to render
                            </span>
                        </div>
                    </div>
                )}

                {error && <div className="error">{error}</div>}

                {items.length === 0 && !error ? (
                    <p className="empty">Nothing loaded yet.</p>
                ) : (
                    <div className="item-grid">
                        {items.map(({item, raw, label, group}, i) => (
                            <section
                                className="item-card"
                                id={`item-${i + 1}`}
                                key={`${loadKey}-${i}`}
                                ref={(el) => {
                                    cardRefs.current[i] = el;
                                }}
                            >
                                <div className="item-card-header">
                                    <span>
                                        Item {i + 1}
                                        {label && (
                                            <span className="item-card-label">
                                                {" "}
                                                · {label}
                                            </span>
                                        )}
                                        {group && (
                                            <span className="item-card-label">
                                                {" "}
                                                · {group}
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-copy"
                                        onClick={() =>
                                            copyText(
                                                JSON.stringify(raw, null, 2),
                                                `item-${i}`,
                                            )
                                        }
                                    >
                                        {copied === `item-${i}`
                                            ? "Copied!"
                                            : "Copy JSON"}
                                    </button>
                                </div>
                                <div className="item-card-body">
                                    <PerseusItemRenderer
                                        item={item}
                                        renderKey={loadKey}
                                    />
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
